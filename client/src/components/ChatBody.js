import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChatBody = ({ activeChat }) => {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const lastMessageRef = useRef(null);
  const currentUser = sessionStorage.getItem('username');

  // Effect to fetch message history when activeChat changes
  useEffect(() => {
    setMessages([]); // Clear previous messages
    setTypingUser(null);
    if (activeChat) {
      socket.emit('getPrivateMessages', { user1: currentUser, user2: activeChat });
    }
  }, [activeChat, currentUser]);

  // Effect to handle real-time events from socket
  useEffect(() => {
    const handlePrivateMessage = (data) => {
      // FIX: Correctly check if the message belongs to the active conversation
      const isForCurrentChat =
        (data.sender === currentUser && data.recipient === activeChat) ||
        (data.sender === activeChat && data.recipient === currentUser);

      if (isForCurrentChat) {
        setMessages((prevMessages) => [...prevMessages, data]);
        setTypingUser(null); // Stop showing typing indicator when message arrives
      } else {
        // Notify user of message from a different chat
        if (data.sender !== currentUser) {
          toast.info(`New message from ${data.sender}`);
        }
      }
    };

    const handleUserTyping = (sender) => {
      if (sender === activeChat) setTypingUser(sender);
    };

    const handleUserStoppedTyping = (sender) => {
      if (sender === activeChat) setTypingUser(null);
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

  // Effect to scroll to the latest message
  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeChat) {
    return (
      <div className="flex-grow p-4 flex items-center justify-center bg-gray-100">
        <ToastContainer />
        <p className="text-gray-500">Select a user from the sidebar to start a conversation.</p>
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
            <div className={`p-3 rounded-lg max-w-md ${msg.sender === currentUser ? 'bg-blue-500 text-white' : 'bg-white shadow'}`}>
              {msg.sender !== currentUser && (
                <p className="font-bold text-sm text-blue-600">{msg.sender}</p>
              )}
              <p>{msg.text}</p>
              <p className={`text-xs mt-1 opacity-70 ${msg.sender === currentUser ? 'text-blue-200' : 'text-gray-500'}`}>
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