'use client';

import { useState, useRef, useEffect } from 'react';
import api from '../api';
import styles from './MentorAI.module.css';

const QUICK_QUESTIONS = [
  "How does detection work?", "Why was my record flagged?",
  "What do risk levels mean?", "What is the blockchain hash?",
  "What can my role access?", "How does batch upload work?",
  "What is SFO detection?", "What does the AI reasoning show?"
];

// Pre-defined local logic for speed
const LOCAL_ANSWERS = {
  "how does detection work?": "ClinicalGuard uses a strictly trained ML Decision Tree analyzing 13 vital/trial features. It calculates expected ranges and finds anomalies.",
  "why was my record flagged?": "Records are flagged (MANIPULATED) when vital signs, history, and calculated Health Risk Scores contradict normal physiological capability.",
  "what do risk levels mean?": "LOW means authentic. MEDIUM indicates borderline vitals. HIGH means overt manipulation or SFO was detected; requires audit.",
  "what is the blockchain hash?": "It's a SHA-256 fingerprint of the data, permanently anchored to Polygon Amoy to prevent future tampering by any actor.",
  "what can my role access?": "Investigator forms data. Admin monitors all pipelines. Regulator/Monitor verify blockchain and audit logs.",
  "how does batch upload work?": "You drag a CSV with the expected 13 columns. The app pre-scans for zero health_risk_score warnings, then processes identically to single checks.",
  "what is sfo detection?": "Selective Field Omission happens when a user sets health_risk_score to 0.00 while other vitals imply active trial participation. It's automatically flagged HIGH risk.",
  "what does the ai reasoning show?": "The Gemini AI takes the ML verdict and plain text vitals and translates why the record failed into clear clinical sentences for practitioners."
};

export default function MentorAI() {
  const [isOpen, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hello! I am Mentor AI. How can I help you understand data integrity today?", sender: "bot", isGemini: false }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const [currentContext, setCurrentContext] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Listen for custom event to set context from any page
    const handleContext = (e) => {
      if (e.detail?.record_id) {
        setOpen(true);
        setCurrentContext(e.detail.record_id);
        const intro = e.detail.intro || `I have loaded context for record ${e.detail.record_id.slice(0, 8)}... How can I assist you with this record?`;
        setMessages(prev => [...prev, { text: intro, sender: "bot", isGemini: false }]);
      }
    };
    
    // Fix A: Listen for generic openMentor event
    const handleOpen = () => setOpen(true);
    
    window.addEventListener('setMentorContext', handleContext);
    window.addEventListener('openMentor', handleOpen);
    
    return () => {
      window.removeEventListener('setMentorContext', handleContext);
      window.removeEventListener('openMentor', handleOpen);
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const handleSend = async (textOverride = null) => {
    const text = textOverride || input.trim();
    if (!text) return;

    // Add user message
    setMessages(prev => [...prev, { text, sender: "user" }]);
    setInput("");
    setShowChips(false);
    setIsTyping(true);

    const lowerText = text.toLowerCase();
    
    // Exact match for local answers
    if (LOCAL_ANSWERS[lowerText]) {
      setTimeout(() => {
        setMessages(prev => [...prev, { text: LOCAL_ANSWERS[lowerText], sender: "bot", isGemini: false }]);
        setIsTyping(false);
      }, 500);
      return;
    }

    // Call backend API for Gemini fallback
    try {
      const payload = { message: text };
      if (currentContext) payload.record_id = currentContext;
      
      const token = sessionStorage.getItem('cg_token');
      const res = await fetch('/api/mentor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      setMessages(prev => [...prev, { text: data.reply, sender: "bot", isGemini: true }]);
    } catch (err) {
      setMessages(prev => [...prev, { text: "I'm having trouble connecting to my AI logic right now. Please try again later.", sender: "bot", isGemini: false }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button className={styles.fab} onClick={() => {}}>
          {/* We rely on the Sidebar button or this could be an independent floating button. 
              The requirements say "floating button in bottom-right corner". 
              Let's make this the primary toggle button */}
        </button>
      )}

      {/* Actual persistent floating toggle if closed */}
      <button className={styles.fab} onClick={() => setOpen(true)} 
         style={{ display: isOpen ? 'none' : 'flex' }}>
         🤖
      </button>

      {isOpen && (
        <div className={styles.chatPanel}>
          <div className={styles.header}>
            <div className={styles.title}>
              <span className={styles.onlineDot}></span>
              🤖 Mentor AI
            </div>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>&times;</button>
          </div>

          <div className={styles.body}>
            {messages.map((msg, i) => (
              <div key={i} className={`${styles.message} ${msg.sender === 'user' ? styles.msgUser : styles.msgBot}`}>
                {msg.text}
                {msg.isGemini && <div className={styles.geminiBadge}>✦ Gemini AI</div>}
              </div>
            ))}
            
            {isTyping && (
              <div className={styles.typingIndicator}>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
              </div>
            )}

            {showChips && !isTyping && (
              <div className={styles.chipsContainer}>
                {QUICK_QUESTIONS.map(q => (
                  <div key={q} className={styles.chip} onClick={() => handleSend(q)}>
                    {q}
                  </div>
                ))}
              </div>
            )}
            
            {!showChips && messages.length > 2 && (
              <div className={styles.showChipsBtn} onClick={() => setShowChips(true)}>
                Quick Questions
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputArea}>
            <input 
              className={styles.input}
              type="text" 
              placeholder="Ask anything..." 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button className={styles.sendBtn} onClick={() => handleSend()} disabled={isTyping || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
