import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChatBody = ({ activeChat }) => {
  const [messages, setMessages] = useState([]);
  const lastMessageRef = useRef(null);
  const currentUser = sessionStorage.getItem('username');

  useEffect(() => {
    setMessages([]);
    if (activeChat) {
      socket.emit('getPrivateMessages', { user1: currentUser, user2: activeChat });
    }
  }, [activeChat, currentUser]);

  useEffect(() => {
    const handlePrivateMessage = (data) => {
      const isForCurrentChat =
        (data.sender === currentUser && data.recipient === activeChat) ||
        (data.sender === activeChat && data.recipient === currentUser);

      if (isForCurrentChat) {
        setMessages((prevMessages) => [...prevMessages, data]);
      } else if (data.sender !== currentUser) {
        toast.info(`New message from ${data.sender}`);
      }
    };

    socket.on('privateMessages', (history) => {
      setMessages(history);
    });

    socket.on('receivePrivateMessage', handlePrivateMessage);

    return () => {
      socket.off('privateMessages');
      socket.off('receivePrivateMessage', handlePrivateMessage);
    };
  }, [activeChat, currentUser]);

  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-grow p-4 overflow-y-auto bg-gray-100">
      <ToastContainer position="top-right" autoClose={3000} />
      {messages.map((msg, index) => (
        <div key={msg._id || index} className={`mb-4 flex ${msg.sender === currentUser ? 'justify-end' : 'justify-start'}`}>
          <div className={`p-3 rounded-lg max-w-md ${msg.sender === currentUser ? 'bg-blue-500 text-white' : 'bg-white shadow'}`}>
            {msg.sender !== currentUser && <p className="font-bold text-sm text-blue-600">{msg.sender}</p>}
            <p>{msg.text}</p>
            <p className={`text-xs mt-1 opacity-70 text-right ${msg.sender === currentUser ? 'text-blue-200' : 'text-gray-500'}`}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      ))}
      <div ref={lastMessageRef} />
    </div>
  );
};

export default ChatBody;