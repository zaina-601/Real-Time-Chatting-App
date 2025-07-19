import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { toast } from 'react-toastify';

const ChatBody = ({ activeChat }) => {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const lastRef = useRef(null);
  const currentUser = sessionStorage.getItem('username');

  useEffect(() => {
    setMessages([]);
    setTypingUser(null);
    if (!activeChat) return;
    console.log("📦 Requesting history", currentUser, activeChat);
    socket.emit('getPrivateMessages', { user1: currentUser, user2: activeChat });
  }, [activeChat]);

  useEffect(() => {
    const onPrivate = data => {
      console.log("⬅️ receivePrivateMessage:", data);
      const isRelevant =
        (data.sender === currentUser && data.recipient === activeChat) ||
        (data.sender === activeChat && data.recipient === currentUser);

      if (isRelevant) {
        setMessages(prev => [...prev, data]);
        setTypingUser(null);
      } else if (data.sender !== currentUser) {
        toast.info(`New message from ${data.sender}`);
      }
    };

    const onHistory = history => {
      console.log("📜 privateMessages:", history);
      setMessages(history);
    };

    const onTyping = user => activeChat === user && setTypingUser(user);
    const onStop = user => activeChat === user && setTypingUser(null);

    socket.on('receivePrivateMessage', onPrivate);
    socket.on('privateMessages', onHistory);
    socket.on('userTyping', onTyping);
    socket.on('userStoppedTyping', onStop);

    return () => {
      socket.off('receivePrivateMessage', onPrivate);
      socket.off('privateMessages', onHistory);
      socket.off('userTyping', onTyping);
      socket.off('userStoppedTyping', onStop);
    };
  }, [activeChat, currentUser]);

  useEffect(() => lastRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-y-auto p-4 bg-gray-100">
        {messages.map((m, i) => (
          <div key={i} className={`mb-2 flex ${m.sender === currentUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-2 rounded ${m.sender === currentUser ? 'bg-blue-500 text-white' : 'bg-white'}`}>
              {m.sender !== currentUser && <strong>{m.sender}</strong>}
              <div>{m.text}</div>
              <small>{new Date(m.timestamp).toLocaleTimeString()}</small>
            </div>
          </div>
        ))}
        <div ref={lastRef} />
      </div>
      <div className="p-2 text-sm italic text-gray-500">
        {typingUser && `${typingUser} is typing…`}
      </div>
    </div>
  );
};

export default ChatBody;
