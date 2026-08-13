import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

function AIChatbox({ onSelectCampaign }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      sender: 'ai', 
      text: 'Salut! Sunt Don AI, un asistent virtual bazat pe Inteligență Artificială. Conform reglementărilor UE (EU AI Act), te informez că interacționezi cu un sistem AI, iar informațiile furnizate sunt generate automat. Cu ce te pot ajuta astăzi în legătură cu donarea de sânge?' 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  // State-uri pentru gestionarea limitării de mesaje (cooldown)
  const [cooldownTime, setCooldownTime] = useState(0);
  const [isCooldownActive, setIsCooldownActive] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll la ultimul mesaj primit sau trimis
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  // Logica pentru cronometrul descrescător (Cooldown)
  useEffect(() => {
    let timer;
    if (isCooldownActive && cooldownTime > 0) {
      timer = setInterval(() => {
        setCooldownTime((prevTime) => {
          if (prevTime <= 1) {
            setIsCooldownActive(false);
            clearInterval(timer);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isCooldownActive, cooldownTime]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isCooldownActive) return;

    const userMessage = inputValue;
    
    // Extragerea istoricului de mesaje existent înainte de adăugarea celui nou
    const historyToSend = messages.filter(m => m.sender === 'user' || m.sender === 'ai');

    // Adăugăm instant mesajul utilizatorului în listă
    setMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setInputValue('');
    setLoading(true);

    try {
      // Apel către ruta LLM din FastAPI trimitând mesajul curent ȘI istoricul
      const response = await axios.post('http://127.0.0.1:8000/ai/chat', { 
        message: userMessage,
        history: historyToSend
      });
      setMessages((prev) => [...prev, { sender: 'ai', text: response.data.reply }]);
    } catch (error) {
      const secondsToWait = error.response?.data?.retry_after || 60;
      setCooldownTime(secondsToWait);
      setIsCooldownActive(true);

      setMessages((prev) => [
        ...prev, 
        { sender: 'ai', text: 'Ai atins limita de mesaje (tokeni) alocați pentru această sesiune.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Culori Tematice
  const PRIMARY_RED = '#9b2226'; 
  const USER_MSG_RED = '#d90429'; 
  const BG_LIGHT_CREAM = '#fdfaf9'; 

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '30px', zIndex: 3000, fontFamily: 'sans-serif' }}>
      
      {/* 1. FEREASTRA PRINCIPALĂ DE CHAT */}
      {isOpen && (
        <div style={{
          width: '360px', height: '450px', backgroundColor: 'white', borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
          marginBottom: '12px', border: '1px solid #f5e6e6', overflow: 'hidden'
        }}>
          {/* Header Fereastră */}
          <div style={{ backgroundColor: PRIMARY_RED, color: 'white', padding: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🩸</span> 
              <span>Asistent Virtual Don AI</span>
            </div>
            <span style={{ fontSize: '12px', backgroundColor: '#198754', padding: '2px 6px', borderRadius: '4px' }}>Online</span>
          </div>

          {/* Zona de Mesaje */}
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', backgroundColor: BG_LIGHT_CREAM, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, index) => (
              <div key={index} style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.sender === 'user' ? USER_MSG_RED : '#ffffff',
                color: msg.sender === 'user' ? 'white' : '#333333',
                padding: '10px 14px', borderRadius: '12px', maxWidth: '85%',
                fontSize: '14px', boxShadow: msg.sender === 'ai' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                border: msg.sender === 'ai' ? '1px solid #f0e2e2' : 'none',
                lineHeight: '1.45'
              }}>
                {msg.sender === 'ai' ? (
                  <div className="markdown-chat-reply">
                    <ReactMarkdown
                      components={{
                        a: ({ node, href, children, ...props }) => {
                          if (href && href.startsWith('#book-campaign-')) {
                            const campaignId = href.replace('#book-campaign-', '');
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (onSelectCampaign) {
                                    onSelectCampaign(campaignId);
                                  }
                                }}
                                style={{
                                  backgroundColor: '#e63946',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  marginTop: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  boxShadow: '0 2px 4px rgba(230,57,70,0.3)'
                                }}
                              >
                                📅 {children}
                              </button>
                            );
                          }
                          return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>;
                        }
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            ))}
            
            {/* Indicator de încărcare (Loading) */}
            {loading && (
              <div style={{ alignSelf: 'flex-start', backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '12px', color: '#718096', fontSize: '13px', fontStyle: 'italic', border: '1px solid #f0e2e2' }}>
                ❤️ Don AI gândește răspunsul...
              </div>
            )}

            {/* Mesajul dinamic de Cooldown */}
            {isCooldownActive && (
              <div style={{ 
                alignSelf: 'center', 
                backgroundColor: '#fff3cd', 
                color: '#856404', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                fontSize: '13px', 
                textAlign: 'center',
                border: '1px solid #ffeeba',
                width: '90%',
                fontWeight: '500'
              }}>
                ⏳ Poți trimite următorul mesaj în <strong>{cooldownTime}</strong> secunde.
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Notificare de transparență conform EU AI Act Art. 50 */}
          <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', padding: '4px', backgroundColor: '#f0f0f0', borderTop: '1px solid #e2e8f0' }}>
            🤖 Interacționezi cu un sistem AI (EU AI Act Art. 50). Informațiile sunt generate automat.
          </div>
        </div>
      )}

      {/* 2. PASTILA FIXĂ DE CHAT */}
      <div style={{
        display: 'flex', alignItems: 'center', backgroundColor: PRIMARY_RED, 
        padding: '8px 14px', borderRadius: '25px', boxShadow: '0 4px 15px rgba(155,34,38,0.25)',
        width: '320px', gap: '10px', border: '1px solid rgba(255,255,255,0.1)',
        opacity: isCooldownActive ? 0.8 : 1
      }}>
        {/* Cercul Don AI Avatar */}
        <div style={{
          backgroundColor: 'white', width: '32px', height: '32px', borderRadius: '50%',
          display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '11px', color: PRIMARY_RED
        }}>
          DonAI
        </div>

        {/* Input Text */}
        <form onSubmit={handleSendMessage} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onClick={() => setIsOpen(true)}
            disabled={isCooldownActive}
            placeholder={isCooldownActive ? `Așteaptă ${cooldownTime}s...` : "Chat cu Don AI"}
            style={{
              width: '100%', background: 'none', border: 'none', color: 'white',
              outline: 'none', fontSize: '14px', padding: '2px 0',
              cursor: isCooldownActive ? 'not-allowed' : 'text'
            }}
          />
          <button type="submit" style={{ display: 'none' }}>Trimite</button>
        </form>

        {/* Săgeata pentru Toggle Sus/Jos */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: 'none', border: 'none', color: 'white', cursor: 'pointer',
            fontSize: '12px', padding: '2px 4px', display: 'flex', alignItems: 'center'
          }}
        >
          {isOpen ? '▼' : '▲'}
        </button>

        {/* Butonul de închidere rapidă (X) */}
        <button 
          onClick={() => setIsOpen(false)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '16px', padding: '0 2px' }}
        >
          &times;
        </button>
      </div>

    </div>
  );
}

export default AIChatbox;