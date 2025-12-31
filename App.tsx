
import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { Message } from './types';
import { sendMessageToSecurity, sendMessageToAssistant } from './services/geminiService';
import { 
  Send, ShieldCheck, User, Bot, Loader2, CheckCircle2, 
  XCircle, AlertTriangle, RefreshCcw, Copy, Check, 
  HelpCircle, X, Sparkles, GraduationCap, UserPlus, KeyRound, RotateCcw
} from 'lucide-react';

// --- CONFIGURATION ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwD662zsplOvQtQ_XIJOTw8XdhmeVjo6l6jUyEgJi5L4D_Av0Rdr-p_IBWHq66cFzfH4g/exec";
const PORTAL_PASSWORD = "sjvs@ix@";

const INITIAL_BOT_MESSAGE: Message = {
  role: 'bot',
  text: "Welcome to the Schoolix Portal. ✨ How can I help you today?\n\n1. **User Registration** (New students / Class Notes Access)\n2. **Helping Assistant** (Academic support & Website usage guide)",
  timestamp: new Date(),
};

const STRIKE_MESSAGES = [
  "❌ Authentication error: The details provided do not match our database records. Please verify your credentials and try again. (Attempt 1/2)",
  "❌ Credentials mismatch detected. Ensure you are providing information exactly as it appears on your official school ID card. (Attempt 1/2)",
  "❌ Verification unsuccessful. Security protocols require precise matching of student data. Please re-check your records. (Attempt 1/2)",
  "❌ Access denied for the provided input. One final attempt remains. Please ensure your details are correct before re-submitting. (Attempt 1/2)"
];

type AppMode = 'CHOICE' | 'REGISTRATION' | 'AUTH' | 'ASSISTANT';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([INITIAL_BOT_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('CHOICE');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const resetApp = () => {
    setMessages([{ ...INITIAL_BOT_MESSAGE, timestamp: new Date() }]);
    setAppMode('CHOICE');
    setInputValue('');
    setIsLoading(false);
    setIsLocked(false);
    setFailedAttempts(0);
    setIsError(false);
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(PORTAL_PASSWORD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendToGoogleSheet = async (finalMessages: Message[]) => {
    try {
      const userMsgs = finalMessages.filter(m => m.role === 'user');
      const data = {
        name: userMsgs[1]?.text || '', 
        adminNo: userMsgs[3]?.text || '',
        roll: userMsgs[4]?.text || '',
        reason: userMsgs[5]?.text || ''
      };

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error("Sheet Sync Error:", error);
    }
  };

  const handleSend = async (forcedValue?: string) => {
    const textToSend = forcedValue || inputValue;
    if (!textToSend.trim() || isLoading) return;

    if (textToSend.toLowerCase().trim() === 'restart') {
      resetApp();
      return;
    }

    if (isLocked && appMode !== 'ASSISTANT') return;

    setIsError(false);

    const userMsg: Message = {
      role: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      let botResponseText = "";
      
      if (appMode === 'CHOICE') {
        const lowerText = textToSend.toLowerCase();
        if (lowerText.includes('registration') || lowerText === '1') {
          setAppMode('REGISTRATION');
          botResponseText = "Understood. Starting **User Registration** protocol. To begin your verification for the Class 9 notes and portal access, could you please tell me your Full Name?";
        } else if (lowerText.includes('assistant') || lowerText === '2') {
          setAppMode('AUTH');
          botResponseText = "Secure access requested. Please provide the **Portal Password** you received during registration to unlock the Helping Assistant.";
        } else {
          botResponseText = "Invalid selection. Please type '1' for Registration or '2' for Helping Assistant.";
        }
      } 
      else if (appMode === 'AUTH') {
        if (textToSend === PORTAL_PASSWORD) {
          setAppMode('ASSISTANT');
          botResponseText = "✅ Password Accepted. Access granted to the **Gemini Flash Helping Assistant**. \n\nI can help you with your Class 9 studies or explain how to use the Schoolix website. How can I assist you today?";
        } else {
          botResponseText = "❌ Incorrect password. Access denied. Please try again or go back to registration if you haven't signed up yet.";
        }
      }
      else if (appMode === 'REGISTRATION') {
        const regUserMsgs = newMessages.filter(m => m.role === 'user');
        if (regUserMsgs.length === 2) { 
           const nameRegex = /^[a-zA-Z\s]{3,50}$/; 
           if (!nameRegex.test(textToSend.trim())) {
             setIsLoading(false);
             setMessages(prev => [...prev, {
               role: 'bot',
               text: "That doesn't look like a valid name. Please enter your real Full Name (letters only).",
               timestamp: new Date()
             }]);
             return;
           }
        }

        botResponseText = await sendMessageToSecurity(newMessages);
        
        if (botResponseText.includes('🚫 Verification Failed')) {
          const newAttemptCount = failedAttempts + 1;
          setFailedAttempts(newAttemptCount);
          if (newAttemptCount < 2) {
            botResponseText = STRIKE_MESSAGES[Math.floor(Math.random() * STRIKE_MESSAGES.length)];
          } else {
            botResponseText = "🚫 Verification Failed. Maximum security attempts reached. Access is permanently denied for this session.";
            setIsLocked(true);
          }
        }

        if (botResponseText.includes('✅ Verification Successful')) {
          setAppMode('ASSISTANT');
          botResponseText += "\n\nYou now have permanent access to the **Helping Assistant**. Feel free to ask any academic questions or website-related queries!\n\n**Important Information:** This password is also for your portal unlock and **Class Notes**. Both sections use the same password. If you came here from the Class Notes section, your registration is now complete for both.";
          sendToGoogleSheet(newMessages);
        }
      }
      else if (appMode === 'ASSISTANT') {
        botResponseText = await sendMessageToAssistant(newMessages);
      }

      setMessages(prev => [...prev, {
        role: 'bot',
        text: botResponseText,
        timestamp: new Date(),
      }]);

    } catch (err) {
      setIsError(true);
      setMessages(prev => [...prev, {
        role: 'bot',
        text: "System encountered an error. Please check your internet connection and try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const isFailedAccess = messages.some(m => m.text.includes('Maximum security attempts reached'));

  const renderMessageContent = (text: string) => {
    const html = marked.parse(text);
    return <div className="prose-chat" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-0 sm:p-4 text-slate-200 font-['Plus_Jakarta_Sans'] relative overflow-hidden">
      
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/20">
                    <HelpCircle className="w-5 h-5 text-blue-400" />
                  </div>
                  <h2 className="text-white font-bold tracking-tight">Portal Assistance</h2>
                </div>
                <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <p>The <span className="text-purple-400 font-semibold">Schoolix Portal</span> offers two main services:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Registration:</strong> Verify identity to get the portal password (also unlocks Class Notes).</li>
                  <li><strong>Helping Assistant:</strong> Academic tutoring AND a usage guide for the Schoolix website features (Resource Hub, CBSE Videos, Verify Corrections, etc.).</li>
                </ul>
                <p className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 text-[13px]">
                  <span className="text-amber-500 font-bold mr-1">Command:</span> Type <span className="text-white font-mono">restart</span> at any time to return to the main selection screen.
                </p>
              </div>
              <button onClick={() => setShowHelp(false)} className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl transition-all border border-slate-700 active:scale-95">Understood</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg bg-[#0f172a] sm:rounded-2xl shadow-2xl flex flex-col h-screen sm:h-[85vh] overflow-hidden border border-slate-800 z-10 transition-all duration-700">
        
        <div className={`px-6 py-5 flex items-center justify-between border-b border-slate-800 transition-colors duration-500 ${appMode === 'ASSISTANT' ? 'bg-indigo-900/40 backdrop-blur-md' : 'bg-[#1e293b]/90 backdrop-blur-sm'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center border shadow-inner transition-all duration-700 ${appMode === 'ASSISTANT' ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-purple-600/10 border-purple-500/20'}`}>
              {appMode === 'ASSISTANT' ? <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" /> : <ShieldCheck className="w-6 h-6 text-purple-500" />}
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight transition-all duration-500">
                {appMode === 'ASSISTANT' ? 'Helping Assistant' : 'Schoolix Portal'}
              </h1>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLocked ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  {appMode === 'ASSISTANT' ? 'Gemini Flash Active' : appMode === 'REGISTRATION' ? 'Registration In Progress' : isLocked ? 'Session Closed' : 'System Ready'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={resetApp} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all" title="Restart Chat">
              <RotateCcw className="w-5 h-5" />
            </button>
            <button onClick={() => setShowHelp(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all" title="Information">
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-[#030712]/40 relative">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex items-end gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-md transition-all duration-500 ${
                  msg.role === 'user' ? 'bg-purple-600' : appMode === 'ASSISTANT' ? 'bg-indigo-600 border border-indigo-400' : 'bg-slate-800 border border-slate-700'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : appMode === 'ASSISTANT' ? <GraduationCap className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-slate-300" />}
                </div>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg relative group transition-all duration-500 ${
                  msg.role === 'user' 
                  ? 'bg-purple-600 text-white rounded-br-none' 
                  : (msg.text.includes('🚫') || msg.text.includes('❌') || msg.text.includes('Error:')) 
                    ? 'bg-red-500/10 text-red-200 border border-red-500/20 rounded-bl-none'
                    : appMode === 'ASSISTANT'
                        ? 'bg-gradient-to-br from-indigo-900/40 to-slate-800 text-slate-100 rounded-bl-none border border-indigo-500/20'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                }`}>
                  <div className="font-medium">
                    {renderMessageContent(msg.text)}
                  </div>
                  
                  {msg.text.includes('✅ Verification Successful') && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                      <button onClick={copyPassword} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy Password'}
                      </button>
                    </div>
                  )}

                  <div className={`text-[9px] mt-1.5 font-bold uppercase tracking-tighter opacity-40 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {appMode === 'CHOICE' && !isLoading && (
            <div className="flex flex-col gap-3 max-w-[80%] mx-auto mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button 
                onClick={() => handleSend("User Registration")}
                className="flex items-center justify-between gap-4 p-4 bg-slate-800 border border-slate-700 hover:border-purple-500/50 hover:bg-purple-500/10 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500">
                      <UserPlus className="w-5 h-5" />
                   </div>
                   <div className="text-left">
                     <p className="font-bold text-white">Registration</p>
                     <p className="text-[10px] text-slate-400">New students / Class Notes Access</p>
                   </div>
                </div>
                <ShieldCheck className="w-5 h-5 text-slate-600 group-hover:text-purple-500 transition-colors" />
              </button>
              <button 
                onClick={() => handleSend("Helping Assistant")}
                className="flex items-center justify-between gap-4 p-4 bg-slate-800 border border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/10 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                      <KeyRound className="w-5 h-5" />
                   </div>
                   <div className="text-left">
                     <p className="font-bold text-white">Helping Assistant</p>
                     <p className="text-[10px] text-slate-400">Study help & Website guide</p>
                   </div>
                </div>
                <Sparkles className="w-5 h-5 text-slate-600 group-hover:text-indigo-500 transition-colors" />
              </button>
            </div>
          )}
          
          {isLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-slate-800/50 px-5 py-3 rounded-2xl rounded-bl-none border border-slate-700 flex items-center gap-3">
                <div className="flex gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s] ${appMode === 'ASSISTANT' ? 'bg-indigo-500' : 'bg-purple-500'}`}></span>
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s] ${appMode === 'ASSISTANT' ? 'bg-indigo-500' : 'bg-purple-500'}`}></span>
                  <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${appMode === 'ASSISTANT' ? 'bg-indigo-500' : 'bg-purple-500'}`}></span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Processing...</span>
              </div>
            </div>
          )}

          {isError && (
            <div className="sticky bottom-4 left-0 right-0 flex justify-center p-4">
              <button onClick={() => { setIsError(false); handleSend(); }} className="bg-red-500 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-red-600 shadow-xl transition-all">
                <RefreshCcw className="w-3 h-3" /> Retry Connection
              </button>
            </div>
          )}

          {isLocked && isFailedAccess && (
            <div className="mx-auto w-full max-w-sm p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-3 animate-in zoom-in duration-500">
              <XCircle className="w-12 h-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-red-500 font-bold text-sm tracking-widest uppercase">Verification Locked</h3>
                <p className="text-red-500/70 text-xs font-medium mt-1">Access denied permanently for this session. Type 'restart' to try again.</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-5 sm:p-8 bg-[#0f172a] border-t border-slate-800/50">
          <div className={`relative flex items-center transition-all duration-500 ${isLocked && appMode !== 'ASSISTANT' ? 'opacity-20 pointer-events-none grayscale scale-95' : ''}`}>
            <input
              type={appMode === 'AUTH' ? "password" : "text"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                appMode === 'ASSISTANT' ? "Ask anything about studies or website..." : 
                appMode === 'AUTH' ? "Enter Portal Password..." :
                appMode === 'CHOICE' ? "Choose an option above..." :
                "Type your response (or 'restart')..."
              }
              disabled={(isLocked && appMode !== 'ASSISTANT') || isLoading || appMode === 'CHOICE'}
              className={`w-full bg-slate-900 border rounded-2xl py-5 pl-6 pr-16 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-4 transition-all text-sm font-medium ${appMode === 'ASSISTANT' ? 'border-indigo-500/30 focus:ring-indigo-600/20 focus:border-indigo-500/50' : 'border-slate-700/50 focus:ring-purple-600/20 focus:border-purple-500/50'}`}
            />
            <button 
              onClick={() => handleSend()}
              disabled={isLoading || (!inputValue.trim() && appMode !== 'CHOICE') || (isLocked && appMode !== 'ASSISTANT')}
              className={`absolute right-2.5 w-12 h-12 text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:bg-slate-800 disabled:scale-100 shadow-lg ${appMode === 'ASSISTANT' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'}`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="mt-4 flex flex-col items-center gap-1">
            <p className="text-center text-[9px] text-slate-500 font-black uppercase tracking-[0.25em]">
              {appMode === 'ASSISTANT' ? 'Powered by Gemini Flash' : 'Schoolix Portal Infrastructure V4.5'}
            </p>
            <div className={`w-12 h-0.5 rounded-full mt-2 transition-colors duration-500 ${appMode === 'ASSISTANT' ? 'bg-indigo-500' : 'bg-slate-800'}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
