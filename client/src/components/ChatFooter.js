import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';

const ChatFooter = ({ activeChat }) => {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    setMessage('');
  }, [activeChat]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && activeChat) {
      const username = sessionStorage.getItem('username');
      const messageData = { text: message, sender: username, recipient: activeChat };
      socket.emit('sendPrivateMessage', messageData);
      setMessage('');
    }
  };
  
  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (!typingTimeoutRef.current) {
      socket.emit('typing', { sender: sessionStorage.getItem('username'), recipient: activeChat });
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { sender: sessionStorage.getItem('username'), recipient: activeChat });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  return (
    <div className="p-4 bg-gray-200 border-t border-gray-300">
      <form onSubmit={handleSendMessage} className="flex">
        <input
          type="text"
          placeholder={activeChat ? `Message ${activeChat}` : 'Select a user to message'}
          className="flex-grow p-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={message}
          onChange={handleTyping}
          disabled={!activeChat}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600 disabled:bg-gray-400"
          disabled={!activeChat || !message.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatFooter;