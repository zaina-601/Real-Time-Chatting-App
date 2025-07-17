import React, { useState, useRef } from 'react';
import socket from '../socket';

const ChatFooter = ({ activeChat }) => {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef(null);

  const emitStopTyping = () => {
    socket.emit('stopTyping', {
      sender: sessionStorage.getItem('username'),
      recipient: activeChat,
    });
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);

    socket.emit('typing', {
      sender: sessionStorage.getItem('username'),
      recipient: activeChat,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(emitStopTyping, 2000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && activeChat) {
      const username = sessionStorage.getItem('username');
      socket.emit('sendPrivateMessage', {
        text: message,
        sender: username,
        recipient: activeChat,
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      emitStopTyping();
      setMessage('');
    }
  };

  return (
    <div className="p-4 bg-gray-200">
      <form onSubmit={handleSendMessage} className="flex">
        <input
          type="text"
          placeholder={activeChat ? `Message ${activeChat}` : 'Select a user to message'}
          className="flex-grow p-2 border rounded-l-lg"
          value={message}
          onChange={handleTyping}
          disabled={!activeChat}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded-r-lg disabled:bg-gray-400"
          disabled={!activeChat}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatFooter;