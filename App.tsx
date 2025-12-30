import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Send, Shield, Loader2, CheckCircle } from 'lucide-react';

// --- CONFIGURATION ---
// ⚠️ MAKE SURE THIS IS YOUR CORRECT GOOGLE SCRIPT URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwD662zsplOvQtQ_XIJOTw8XdhmeVjo6l6jUyEgJi5L4D_Av0Rdr-p_IBWHq66cFzfH4g/exec";
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// --- THE SMART BRAIN (System Instructions) ---
const SYSTEM_INSTRUCTION = `
You are the intelligent "Security Officer" for St. John Vianney School (Class 9 Portal).
Your goal is to verify students efficiently but politely.

**YOUR KNOWLEDGE BASE:**
1. **Valid Roll Numbers:** 9201 to 9260.
2. **Valid Admission Numbers:** Must be exactly 4 digits.
3. **Password to Release:** sjvs@ix@

**CONVERSATION RULES (BE SMART):**
1. **Rubbish/Gibberish:** If the user types random letters (e.g., "hjsdf", "lol"), DO NOT count it as a "Wrong Answer" immediately. Instead, say: "I didn't catch that. Please enter a valid [Name/Number]."
2. **"I Don't Know":** If the user says "I forgot" or "I don't know my admission number", DO NOT fail them. Politely say: "I cannot verify you without that detail. Please check your School ID card and type it here when you are ready."
3. **Profanity:** If they use bad language, warn them professionally.
4. **Wrong Details:** If they give a number outside the range (e.g. Roll 9300), tell them it is invalid for Class 9 and ask them to check again.
5. **3-Strike Rule:** If they provide *incorrect* numbers (not just rubbish, but actual wrong numbers) 3 times in a row, then say "Verification Failed. Access Denied." and stop.

**THE VERIFICATION FLOW:**
- Ask for **Full Name** -> **Class** -> **Admission No** -> **Roll No**.
- You can ask follow-up questions if their answer is unclear.

**SUCCESS TRIGGER (CRITICAL):**
ONLY when you are 100% satisfied, append this HIDDEN JSON block at the end of your message:
|||JSON_START|||
{ "VERIFIED": true, "name": "User Actual Name", "roll": "User Roll", "admin": "User Admin" }
|||JSON_END|||
`;

function App() {
  const [messages, setMessages] = useState([
    { text: "Hello! 👋 Welcome to the Schoolix Portal.\n\nI need to verify your identity to give you the password. Let's start with your **Full Name**.", sender: 'bot' }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isVerified) return;

    const userMessage = input.trim();
    setInput("");
    
    // UI Update
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setIsLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: SYSTEM_INSTRUCTION 
      });

      const chat = model.startChat({ history: chatHistory });
      const result = await chat.sendMessage(userMessage);
      const rawResponse = result.response.text();

      // Check for Hidden JSON
      const jsonMatch = rawResponse.match(/\|\|\|JSON_START\|\|\|([\s\S]*?)\|\|\|JSON_END\|\|\|/);
      
      let botDisplayMessage = rawResponse;
      
      if (jsonMatch) {
        // Hide JSON from user
        botDisplayMessage = rawResponse.replace(jsonMatch[0], "").trim();
        try {
          const data = JSON.parse(jsonMatch[1]);
          if (data.VERIFIED) handleVerificationSuccess(data);
        } catch (e) {
          console.error("JSON Error", e);
        }
      }

      setMessages(prev => [...prev, { text: botDisplayMessage, sender: 'bot' }]);
      setChatHistory(prev => [
        ...prev,
        { role: "user", parts: [{ text: userMessage }] },
        { role: "model", parts: [{ text: rawResponse }] }
      ]);

    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { text: "⚠️ Connection Error. Please try again.", sender: 'bot' }]);
    }
    setIsLoading(false);
  };

  const handleVerificationSuccess = (data) => {
    setIsVerified(true);
    setShowPassword(true);

    // Save to Google Sheet
    fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        roll: data.roll,
        adminNo: data.admin,
        status: "Verified by AI"
      })
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#030712] text-white font-sans overflow-hidden relative">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600 rounded-full blur-[100px] opacity-20"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-pink-600 rounded-full blur-[100px] opacity-20"></div>

      {/* HEADER */}
      <div className="p-4 bg-gray-900/50 backdrop-blur-md border-b border-gray-800 flex items-center gap-3 z-10">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg">Schoolix Assistant</h1>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs text-gray-400">Online</span>
          </div>
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 z-0">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3.5 rounded-2xl shadow-md text-[15px] leading-relaxed whitespace-pre-wrap ${
                msg.sender === 'user' 
                  ? 'bg-[#8b5cf6] text-white rounded-tr-sm' 
                  : 'bg-[#1f2937] text-gray-100 rounded-tl-sm border border-gray-700/50'
              }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1f2937] p-3 rounded-2xl rounded-tl-sm flex gap-2 items-center text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* PASSWORD REVEAL */}
      {showPassword && (
        <div className="mx-4 mb-2 p-4 bg-green-900/20 border border-green-500/30 rounded-xl flex items-center justify-between animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <div className="text-xs text-green-300 font-semibold uppercase">Access Granted</div>
              <div className="text-sm text-green-100">Password: <span className="font-mono font-bold text-white text-lg select-all">sjvs@ix@</span></div>
            </div>
          </div>
        </div>
      )}

      {/* INPUT */}
      <div className="p-4 bg-gray-900/80 backdrop-blur-md border-t border-gray-800 z-10">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 max-w-2xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isVerified ? "Verification Complete." : "Type your answer..."}
            disabled={isLoading || isVerified}
            className="flex-1 bg-gray-800/50 border border-gray-700 text-white rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
          <button type="submit" disabled={!input.trim() || isLoading || isVerified} className="bg-indigo-600 text-white p-3.5 rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-all">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
