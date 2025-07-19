import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';

const ChatFooter = ({ activeChat }) => {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    setMessage('');
  }, [activeChat]);

  const handleSendMessage = e => {
    e.preventDefault();
    if (!message.trim() || !activeChat) return;
    const sender = sessionStorage.getItem('username');
    console.log("➤ Emitting sendPrivateMessage:", { text: message, sender, recipient: activeChat });
    socket.emit('sendPrivateMessage', { text: message, sender, recipient: activeChat });
    setMessage('');
  };

  const handleTyping = e => {
    setMessage(e.target.value);
    const sender = sessionStorage.getItem('username');
    if (!typingTimeoutRef.current) {
      console.log("… Typing start");
      socket.emit('typing', { sender, recipient: activeChat });
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { sender, recipient: activeChat });
      typingTimeoutRef.current = null;
    }, 1500);
  };

  return (
    <div className="p-4 bg-gray-200 border-t border-gray-300">
      <form onSubmit={handleSendMessage} className="flex">
        <input
          type="text"
          placeholder={activeChat ? `Message ${activeChat}` : 'Select a chat'}
          className="flex-grow p-2"
          value={message}
          onChange={handleTyping}
          disabled={!activeChat}
        />
        <button type="submit" disabled={!message.trim()} className="bg-blue-500 text-white px-4">
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatFooter;
