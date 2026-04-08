import { useState } from 'react';
import { aiAPI } from '../../services/api';

export default function ChatBox({ ehrId, onClose }) {
  const [question, setQuestion] = useState('');
  const [chatLog, setChatLog] = useState([
    { role: 'assistant', text: 'Hello! I am reading the medical record right now. What would you like to know about it?' }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!question.trim() || loading) return;

    const userQ = question.trim();
    setChatLog(prev => [...prev, { role: 'user', text: userQ }]);
    setQuestion('');
    setLoading(true);

    try {
      const { answer } = await aiAPI.chat(ehrId, userQ);
      setChatLog(prev => [...prev, { role: 'assistant', text: answer }]);
    } catch (err) {
      setChatLog(prev => [...prev, { role: 'assistant', text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbox-container" style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
      <div className="chatbox-messages" style={{ flex: 1, overflowY: 'auto', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '8px', marginBottom: '10px' }}>
        {chatLog.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', marginBottom: '10px' }}>
            <div style={{
              display: 'inline-block',
              padding: '10px 14px',
              borderRadius: '16px',
              backgroundColor: msg.role === 'user' ? '#007bff' : '#e5e7eb',
              color: msg.role === 'user' ? 'white' : 'black',
              maxWidth: '80%'
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && <div style={{ textAlign: 'left', fontStyle: 'italic', color: 'gray' }}>Thinking... 🤖</div>}
      </div>
      
      <div className="chatbox-input" style={{ display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value={question} 
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question about this record..."
          style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading} className="btn btn-primary">Send</button>
      </div>
    </div>
  );
}
