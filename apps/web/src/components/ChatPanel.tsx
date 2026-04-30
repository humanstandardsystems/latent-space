import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext.tsx';

interface ChatMsg {
  id: string;
  accountId: string;
  message: string;
  createdAt: string;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const { send, subscribe } = useWebSocket();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'chat_message') {
        setMessages((prev) => [...prev.slice(-99), msg.data as ChatMsg]);
      }
    });
  }, [subscribe]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    send('chat', { message: input.trim() });
    setInput('');
  }

  return (
    <div style={{
      width: 240,
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(10, 0, 16, 0.9)',
      borderLeft: '1px solid #1a0030',
      fontFamily: 'monospace',
    }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1a0030', fontSize: 11, color: '#4c1d95' }}>
        chat
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ fontSize: 12 }}>
            <span style={{ color: '#6d28d9' }}>{m.accountId.slice(0, 6)}</span>
            <span style={{ color: '#4a3060' }}> › </span>
            <span style={{ color: '#c4b5fd' }}>{m.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} style={{ padding: '8px 12px', borderTop: '1px solid #1a0030', display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="say something..."
          maxLength={500}
          style={{
            flex: 1,
            background: '#0a0010',
            border: '1px solid #2d1b4e',
            borderRadius: 3,
            color: '#e0d0ff',
            padding: '5px 8px',
            fontFamily: 'monospace',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button type="submit" style={{ background: '#4c1d95', color: '#e0d0ff', border: 'none', borderRadius: 3, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
          →
        </button>
      </form>
    </div>
  );
}
