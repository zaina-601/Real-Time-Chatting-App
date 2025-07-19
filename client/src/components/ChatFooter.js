import React, { useState, useEffect } from 'react';
import socket from '../socket';

const ChatFooter = ({ activeChat }) => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage('');
  }, [activeChat]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && activeChat) {
      const username = sessionStorage.getItem('username');
      const messageData = {
        text: message,
        sender: username,
        recipient: activeChat,
      };

      console.log("CLIENT SENDING: 'sendPrivateMessage' with data:", messageData);
      socket.emit('sendPrivateMessage', messageData);
      setMessage('');
    } else {
        console.log("CLIENT NOT SENDING: Message is empty or no active chat selected.");
    }
  };

  return (
    <div className="p-4 bg-gray-200 border-t border-gray-300">
      <form onSubmit={handleSendMessage} className="flex">
        <input
          type="text"
          placeholder={activeChat ? `Message ${activeChat}` : 'Select a user to message'}
          className="flex-grow p-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
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