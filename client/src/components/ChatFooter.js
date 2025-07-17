import React, { useState } from 'react';
import socket from '../socket';

const ChatFooter = () => {
  const [message, setMessage] = useState('');

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      const username = sessionStorage.getItem('username');
      socket.emit('sendMessage', { text: message, username });
      setMessage('');
    }
  };

  return (
    <div className="p-4 bg-gray-200">
      <form onSubmit={handleSendMessage} className="flex">
        <input
          type="text"
          placeholder="Type your message..."
          className="flex-grow p-2 border rounded-l-lg"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit" className="bg-blue-500 text-white p-2 rounded-r-lg">
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatFooter;