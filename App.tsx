
import React, { useState, useRef, useEffect } from 'react';
import { Message } from './types';
import { sendMessageToSecurity } from './services/geminiService';
import { Send, ShieldCheck, User, Bot, Loader2, CheckCircle2, XCircle } from 'lucide-react';

// --- CONFIGURATION ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwD662zsplOvQtQ_XIJOTw8XdhmeVjo6l6jUyEgJi5L4D_Av0Rdr-p_IBWHq66cFzfH4g/exec";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      text: "Hello! 👋 Welcome to the Schoolix Student Portal. I am here to verify your identity and provide you with the password for the Class 9 notes.\nTo get started, please tell me your Full Name",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  
  // States to capture data for Google Sheets
  const [studentData, setStudentData] = useState({
    name: '',
    classSection: '',
    admissionNo: '',
    rollNo: '',
    reason: ''
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle data extraction from the flow
  useEffect(() => {
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMsg = userMessages[userMessages.length - 1];
    
    if (lastUserMsg) {
      const index = userMessages.length - 1;
      setStudentData(prev => {
        const next = { ...prev };
        if (index === 0) next.name = lastUserMsg.text;
        if (index === 1) next.classSection = lastUserMsg.text;
        if (index === 2) next.admissionNo = lastUserMsg.text;
        if (index === 3) next.rollNo = lastUserMsg.text;
        if (index === 4) next.reason = lastUserMsg.text;
        return next;
      });
    }
  }, [messages]);

  const sendToGoogleSheet = async (name: string, adminNo: string, rollNo: string, reason: string) => {
    try {
      const data = {
        name: name,
        adminNo: adminNo,
        roll: rollNo,
        reason: reason
      };

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      console.log("Verification data successfully dispatched to Google Sheets.");
    } catch (error) {
      console.error("Error logging to Google Sheets:", error);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || isLocked) return;

    const userMsg: Message = {
      role: 'user',
      text: inputValue,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    const botResponseText = await sendMessageToSecurity(newMessages);
    
    const botMsg: Message = {
      role: 'bot',
      text: botResponseText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, botMsg]);
    setIsLoading(false);

    // Watch for success phrase to trigger backend save
    if (botResponseText.includes('✅ Verification Successful')) {
      setIsLocked(true);
      
      const userMessages = newMessages.filter(m => m.role === 'user');
      // Map correctly based on conversation sequence (index 0=name, 2=admin, 3=roll, 4=reason)
      const finalName = studentData.name || userMessages[0]?.text || '';
      const finalAdminNo = userMessages[2]?.text || studentData.admissionNo || '';
      const finalRollNo = userMessages[3]?.text || studentData.rollNo || '';
      const finalReason = userMessages[4]?.text || studentData.reason || '';
      
      sendToGoogleSheet(finalName, finalAdminNo, finalRollNo, finalReason);
    }

    // Watch for fail phrase to lock input
    if (botResponseText.includes('🚫 Verification Failed')) {
      setIsLocked(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-0 sm:p-4 text-slate-200 font-['Plus_Jakarta_Sans']">
      <div className="w-full max-w-lg bg-[#0f172a] sm:rounded-2xl shadow-2xl flex flex-col h-screen sm:h-[85vh] overflow-hidden border border-slate-800">
        
        {/* Messenger Header */}
        <div className="bg-[#1e293b]/90 backdrop-blur-sm px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-purple-600/10 flex items-center justify-center border border-purple-500/20 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">Schoolix Assistant</h1>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLocked ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  {isLocked ? 'Session Closed' : 'Security Active'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-[#030712]/40">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex items-end gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-md ${
                  msg.role === 'user' ? 'bg-purple-600' : 'bg-slate-800 border border-slate-700'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-slate-300" />}
                </div>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${
                  msg.role === 'user' 
                  ? 'bg-purple-600 text-white rounded-br-none' 
                  : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                }`}>
                  <div className="whitespace-pre-wrap font-medium">{msg.text}</div>
                  <div className={`text-[9px] mt-1.5 font-bold uppercase tracking-tighter opacity-40 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-slate-800/50 px-5 py-3 rounded-2xl rounded-bl-none border border-slate-700 flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></span>
                </div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Verifying...</span>
              </div>
            </div>
          )}
          
          {isLocked && messages.some(m => m.text.includes('Successful')) && (
            <div className="mx-auto w-full max-w-sm p-5 bg-green-500/10 border border-green-500/20 rounded-2xl text-center space-y-2 animate-in zoom-in duration-500">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
              <h3 className="text-green-500 font-bold text-sm tracking-widest uppercase">Verification Success</h3>
              <p className="text-green-500/70 text-xs">Your data has been securely recorded. You may proceed.</p>
            </div>
          )}

          {isLocked && messages.some(m => m.text.includes('Failed')) && (
            <div className="mx-auto w-full max-w-sm p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-2 animate-in zoom-in duration-500">
              <XCircle className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className="text-red-500 font-bold text-sm tracking-widest uppercase">Verification Failed</h3>
              <p className="text-red-500/70 text-xs font-medium">Unfortunately, verification requirements were not met.</p>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Modern Input Bar */}
        <div className="p-5 sm:p-8 bg-[#0f172a] border-t border-slate-800/50">
          <div className={`relative flex items-center transition-all duration-500 ${isLocked ? 'opacity-20 pointer-events-none grayscale scale-95' : ''}`}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isLocked ? "Session finalized" : "Type your answer..."}
              disabled={isLocked || isLoading}
              className="w-full bg-slate-900 border border-slate-700/50 rounded-2xl py-5 pl-6 pr-16 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-purple-600/20 focus:border-purple-500/50 transition-all text-sm font-medium"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim() || isLocked}
              className="absolute right-2.5 w-12 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center hover:bg-purple-500 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:bg-slate-800 disabled:scale-100 shadow-lg shadow-purple-600/20"
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
              St. John Vianney School | Portal
            </p>
            <div className="w-12 h-0.5 bg-slate-800 rounded-full mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
