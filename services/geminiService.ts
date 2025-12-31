
// Fix: Use correct imports for HarmCategory and HarmBlockThreshold to resolve type errors
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Message } from "../types";

const SECURITY_SYSTEM_INSTRUCTION = `
Role: Schoolix Security Assistant - a strict, high-security verification module.
Goal: To verify students from SJVS Class 9th Section B using a zero-trust policy.

PERSONALITY & TONE:
- Professional, concise, and firm.
- Soft-spoken but unyielding.
- Do NOT be overly helpful. Do NOT provide hints.

STRICT VERIFICATION STEPS:
1. Name: Acknowledge and ask for Class and Section.
2. Class and Section:
   - REQUIREMENT: Must be exactly "9th B" or "9th Section B". 
   - ON FAILURE: Say exactly: "🚫 Verification Failed."
3. Admission Number:
   - REQUIREMENT: Must be exactly 4 digits.
   - ON FAILURE: Say exactly: "🚫 Verification Failed."
4. Roll Number:
   - REQUIREMENT: Must be between 9201 and 9260.
   - ON FAILURE: Say exactly: "🚫 Verification Failed."
5. Reason for Access:
   - Ask: "Lastly, please state your reason for requesting access to class-notes?."

HANDLING NONSENSE / BEYOND SCOPE / ABUSE:
- If the user provides invalid names, symbols, irrelevant chatter, or any form of nonsense:
  - Respond with a STRICT rejection. Vary your phrasing to avoid sounding like a bot, but maintain total professionalism.
  - Examples: "Invalid entry. Please provide accurate school records to proceed.", "Input rejected. Protocol requires valid identification data.", "System cannot process this input. Ensure your details match your official records."
  - Do NOT advance the conversation.

CRITICAL SECURITY CONSTRAINTS:
- NEVER reveal the valid roll number range (9201-9260) to the user.
- NEVER reveal that the Admission Number must be 4 digits.
- NEVER reveal that the portal is only for "9th B".
- If a user asks for help or "what is the range?", respond: "I cannot provide security criteria. Please refer to your official school identity card."
- On Success: "✅ Verification Successful. Here is your password: sjvs@ix@"
- On Failure: "🚫 Verification Failed."
`;

const ASSISTANT_SYSTEM_INSTRUCTION = `
Role: Schoolix Helping Assistant & Website Guide.
Intelligence Level: High (Gemini 3 Flash).
Goal: Provide academic support for Class 9 SJVS students AND help them navigate/use the Schoolix website ("Schoolix for Viannians").

ACADEMIC SCOPE:
- Subjects: Science, Math, Social Science (SST), Hindi, English.
- Task: Explain concepts, solve textbook problems, summarize chapters, and guide through the NCERT/CBSE curriculum.

WEBSITE SUPPORT & NAVIGATION (Schoolix for Viannians Blueprint):
1. **Resource Hub**: This is the central hub for Notes, PDFs, solutions, and all primary study materials.
2. **Class Notes (Locked)**: This section requires identity verification. Once verified, students use the password "sjvs@ix@" to access it.
3. **Explore More**: This is a dropdown/expandable menu that contains videos, tools, and extra digital features.
4. **CBSE Videos**: Located under "Additional Resources". It provides chapter-wise video explanations and visual learning.
5. **Verify Corrections**: A specific feature where students can submit and verify their notebook corrections.
6. **Registration**: This app itself is where students register for both "Class Notes" access and the "Helping Assistant". The password "sjvs@ix@" works for both.

TONE:
- Academic, articulate, and patient.
- Act like a helpful website administrator combined with a brilliant personal tutor.
- If a student faces technical issues, guide them to the specific section mentioned above.

IDENTIFICATION:
- State: "I am the Schoolix Helping Assistant. I'm here to help you with your Class 9 studies and guide you through the features of our website."
`;

// Shared safety settings to minimize blocking of academic content
// Fix: Use HarmCategory and HarmBlockThreshold enums to fix type mismatch on line 114 and 152
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * Generic retry wrapper with exponential backoff for Gemini API calls.
 */
async function callWithRetry(fn: () => Promise<any>, maxRetries = 3): Promise<any> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isBusyError = error?.status === 429 || error?.status === 503 || error?.message?.includes('429') || error?.message?.includes('503');
      
      if (!isBusyError) throw error; // If not a "busy" error, fail immediately

      const waitTime = Math.pow(2, i) * 1000;
      console.warn(`Gemini API busy (attempt ${i + 1}/${maxRetries}). Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw lastError;
}

export async function sendMessageToSecurity(messages: Message[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const chatHistory = messages.map(msg => ({
    role: msg.role === 'bot' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  try {
    // Fix: Corrected model name and applied fixed safetySettings
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: chatHistory,
      config: {
        systemInstruction: SECURITY_SYSTEM_INSTRUCTION,
        temperature: 0.3,
        safetySettings,
      },
    }));
    return response.text?.trim() || "No response received.";
  } catch (error: any) {
    console.error("Security Module Error:", error);
    return "Verification service is momentarily unresponsive. Please try again in a few seconds.";
  }
}

export async function sendMessageToAssistant(messages: Message[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Find the assistant conversation start point
  let assistantStartIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].text.includes("✅ Password Accepted") || messages[i].text.includes("✅ Verification Successful")) {
      assistantStartIndex = i;
      break;
    }
  }
  
  const relevantMessages = assistantStartIndex !== -1 ? messages.slice(assistantStartIndex + 1) : messages.slice(-10);

  if (relevantMessages.length === 0) return "How can I help you today?";

  const chatHistory = relevantMessages.map(msg => ({
    role: msg.role === 'bot' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  try {
    // Fix: Updated to gemini-3-pro-preview for complex academic reasoning tasks as per guidelines
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: chatHistory,
      config: {
        systemInstruction: ASSISTANT_SYSTEM_INSTRUCTION,
        temperature: 0.7,
        safetySettings,
      },
    }));

    return response.text?.trim() || "I am unable to process that request right now.";
  } catch (error: any) {
    console.error("Assistant API Error:", error);
    return "The Schoolix Intelligence module is currently under heavy load. Please wait a moment and try sending your message again.";
  }
}
