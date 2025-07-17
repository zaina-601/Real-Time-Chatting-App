import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChatBody = () => {
  const [messages, setMessages] = useState([]);
  const lastMessageRef = useRef(null);
  const currentUser = sessionStorage.getItem('username');

  useEffect(() => {
    socket.on('previousMessages', (prevMessages) => {
      setMessages(prevMessages);
    });

    socket.on('receiveMessage', (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
      if (data.username !== currentUser) {
        toast.info(`New message from ${data.username}`);
      }
    });

    socket.on('userJoined', (message) => {
      toast.success(message);
    });

    socket.on('userLeft', (message) => {
      toast.error(message);
    });

    return () => {
      socket.off('previousMessages');
      socket.off('receiveMessage');
      socket.off('userJoined');
      socket.off('userLeft');
    };
  }, [currentUser]);

  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-grow p-4 overflow-y-auto bg-gray-50">
      <ToastContainer />
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`mb-4 flex ${msg.username === currentUser ? 'justify-end' : 'justify-start'}`}
        >
          <div className={`p-3 rounded-lg ${msg.username === currentUser ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
            <p className="font-bold">{msg.username}</p>
            <p>{msg.text}</p>
          </div>
        </div>
      ))}
      <div ref={lastMessageRef} />
    </div>
  );
};

export default ChatBody;