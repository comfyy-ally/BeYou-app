import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export const ChatComponent: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [message, setMessage] = useState('');
  const [chatLog, setChatLog] = useState<string[]>([]);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('chat-message', (msg: string) => {
      setChatLog((prev) => [...prev, msg]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && message.trim()) {
      socket.emit('chat-message', message);
      setMessage('');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h3>Live Socket Chat Test</h3>
      <div style={{ border: '1px solid #ccc', height: '200px', overflowY: 'scroll', marginBottom: '10px', padding: '10px' }}>
        {chatLog.map((msg, index) => (
          <div key={index}>{msg}</div>
        ))}
      </div>
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '8px' }}
        />
        <button type="submit" style={{ padding: '8px 16px' }}>Send</button>
      </form>
    </div>
  );
};

export default ChatComponent;
