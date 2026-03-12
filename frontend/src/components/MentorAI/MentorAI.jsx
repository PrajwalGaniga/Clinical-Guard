import { useState, useRef, useEffect } from 'react';
import api from '../../api';
import qaData from './mentorQA.json';
import styles from './MentorAI.module.css';

export default function MentorAI() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('openMentor', handler);
    return () => window.removeEventListener('openMentor', handler);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const findLocalAnswer = (text) => {
    const lower = text.toLowerCase();
    let bestScore = 0;
    let answer = null;
    
    qaData.forEach(item => {
      const keywords = item.keywords || [];
      const matchCount = keywords.filter(k => lower.includes(k)).length;
      const score = matchCount / Math.max(keywords.length, 1);
      
      if (score > bestScore && score >= 0.3) {
        bestScore = score;
        answer = item.answer;
      }
    });
    return answer;
  };

  const handleSend = async (text) => {
    if (!text.trim()) return;
    
    const userMsg = { text, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setShowChips(false);
    setTyping(true);

    const localAns = findLocalAnswer(text);

    if (localAns) {
      setTimeout(() => {
        setMessages(prev => [...prev, { text: localAns, source: 'local', sender: 'bot' }]);
        setTyping(false);
      }, 400);
    } else {
      try {
        const res = await api.post('/mentor/chat', { message: text });
        setMessages(prev => [...prev, { text: res.data.reply, source: 'gemini', sender: 'bot' }]);
      } catch (err) {
        setMessages(prev => [...prev, { 
          text: "I couldn't connect to Gemini right now. Please check your API key configuration.", 
          source: 'error', sender: 'bot' 
        }]);
      } finally {
        setTyping(false);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend(input);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.icon}>🤖</span> Mentor AI
        </div>
        <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className={styles.chatArea}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            Welcome to Mentor AI. How can I assist with your clinical review today?
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`${styles.messageWrap} ${m.sender === 'user' ? styles.userWrap : styles.botWrap}`}>
            <div className={`${styles.messageBubble} ${m.sender === 'user' ? styles.userBubble : styles.botBubble}`}>
              {m.text}
            </div>
            {m.source === 'gemini' && (
              <div className={styles.geminiLabel}>✦ Gemini AI</div>
            )}
            {m.source === 'error' && (
              <div className={styles.errorLabel}>System Error</div>
            )}
          </div>
        ))}
        
        {typing && (
          <div className={styles.typingIndicator}>
            <span></span><span></span><span></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {(messages.length === 0 || showChips) && (
        <div className={styles.chipsArea}>
          <button className={styles.chip} onClick={() => handleSend("What is an SFO overriding?")}>What is SFO?</button>
          <button className={styles.chip} onClick={() => handleSend("Explain blockchain integration")}>Blockchain Info</button>
          <button className={styles.chip} onClick={() => handleSend("How does the ML risk score work?")}>Risk Score</button>
        </div>
      )}

      <div className={styles.inputArea}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          className={styles.input}
        />
        <button 
          className={styles.sendBtn}
          onClick={() => handleSend(input)}
          disabled={!input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
