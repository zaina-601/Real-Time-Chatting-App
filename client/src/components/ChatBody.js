import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChatBody = ({ activeChat }) => {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const lastMessageRef = useRef(null);
  const currentUser = sessionStorage.getItem('username');

  useEffect(() => {
    setMessages([]);
    setTypingUser(null);

    if (activeChat) {
      socket.emit('getPrivateMessages', { user1: currentUser, user2: activeChat });
    }
  }, [activeChat, currentUser]);

  useEffect(() => {
    const handlePrivateMessage = (data) => {
      if (data.sender === activeChat || data.sender === currentUser) {
        setMessages((prevMessages) => [...prevMessages, data]);
      }
      if (data.sender !== currentUser) {
        toast.info(`New message from ${data.sender}`);
      }
      setTypingUser(null);
    };

    const handleUserTyping = (sender) => {
      if (sender === activeChat) {
        setTypingUser(sender);
      }
    };

    const handleUserStoppedTyping = (sender) => {
      if (sender === activeChat) {
        setTypingUser(null);
      }
    };

    socket.on('privateMessages', (history) => setMessages(history));
    socket.on('receivePrivateMessage', handlePrivateMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);

    return () => {
      socket.off('privateMessages');
      socket.off('receivePrivateMessage', handlePrivateMessage);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
    };
  }, [activeChat, currentUser]);

  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeChat) {
    return (
      <div className="flex-grow p-4 flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Select a user from the sidebar to start a conversation.</p>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-grow p-4 overflow-y-auto bg-gray-100">
        <ToastContainer />
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-4 flex ${msg.sender === currentUser ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`p-3 rounded-lg max-w-md ${msg.sender === currentUser ? 'bg-blue-500 text-white' : 'bg-white'}`}>
              {msg.sender !== currentUser && (
                <p className="font-bold text-sm text-blue-600">{msg.sender}</p>
              )}
              <p className="text-gray-800">{msg.text}</p>
              <p className="text-xs text-right mt-1 opacity-60">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={lastMessageRef} />
      </div>

      <div className="h-6 px-4 text-gray-500 italic">
        {typingUser && `${typingUser} is typing...`}
      </div>
    </div>
  );
};

export default ChatBody;