import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChatBody = ({ activeChat }) => {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const lastMessageRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentUser = sessionStorage.getItem('username');

  useEffect(() => {
    if (activeChat) {
      setLoading(true);
      setMessages([]); 
      socket.emit('getPrivateMessages', { user1: currentUser, user2: activeChat });
    }
  }, [activeChat, currentUser]);

  useEffect(() => {
    const handlePrivateMessages = (history) => {
      setMessages(Array.isArray(history) ? history : []);
      setLoading(false);
    };

    const handleReceiveMessage = (data) => {
      if (!data || !data.sender || !data.recipient) return;

      const isForCurrentChat =
        (data.sender === currentUser && data.recipient === activeChat) ||
        (data.sender === activeChat && data.recipient === currentUser);

      if (isForCurrentChat) {
        setMessages(prevMessages => [...prevMessages, data]);
        setTypingUser(null); 
      } else if (data.sender !== currentUser) {s
        toast.info(`New message from ${data.sender}`);
      }
    };

    const handleUserTyping = (sender) => {
      if (sender === activeChat) {
        setTypingUser(sender);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
      }
    };

    const handleUserStoppedTyping = (sender) => {
      if (sender === activeChat) {
        setTypingUser(null);
      }
    };

    socket.on('privateMessages', handlePrivateMessages);
    socket.on('receivePrivateMessage', handleReceiveMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);

    return () => {
      socket.off('privateMessages', handlePrivateMessages);
      socket.off('receivePrivateMessage', handleReceiveMessage);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [activeChat, currentUser]);

  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderContent = () => {
    if (!activeChat) {
      return (
        <div className="flex items-center justify-center h-full text-center text-gray-500">
          <div>
            <div className="text-6xl mb-4">💬</div>
            <p>Select a user from the sidebar to start a conversation.</p>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-center text-gray-500">
          <div>
            <div className="text-4xl mb-4"></div>
            <p>No messages yet. Be the first to say hello!</p>
          </div>
        </div>
      );
    }

    let lastDate = null;

    return messages.map((message, index) => {
      if (!message || !message.timestamp) return null; 

      const isOwnMessage = message.sender === currentUser;
      const messageDate = formatDate(message.timestamp);
      const showDate = messageDate !== lastDate;
      lastDate = messageDate;

      if (message.eventType) {
        return (
          <div key={message._id || index}>
            {showDate && <div className="text-center text-xs text-gray-500 my-4">{messageDate}</div>}
            <div className="flex items-center justify-center my-3">
              <div className="text-xs text-gray-600 bg-gray-100 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm border">
                {message.eventType === 'call_started' ? '📞' : '🛑'}
                <span>{message.text}</span>
                {message.duration && (
                  <span className="font-semibold">({message.duration})</span>
                )}
                <span className="text-gray-400">{formatTime(message.timestamp)}</span>
              </div>
            </div>
          </div>
        );
      }
      
      return (
        <div key={message._id || index}>
            {showDate && <div className="text-center text-xs text-gray-500 my-4">{messageDate}</div>}
            <div className={`flex items-end gap-2 my-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-lg p-3 rounded-2xl ${isOwnMessage ? 'bg-blue-500 text-white rounded-br-lg' : 'bg-gray-200 text-gray-800 rounded-bl-lg'}`}>
                  <p className="text-sm break-words">{message.text}</p>
                  <p className={`text-xs mt-1.5 text-right ${isOwnMessage ? 'text-blue-200' : 'text-gray-500'}`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
            </div>
        </div>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {renderContent()}
        {typingUser && (
          <div className="flex items-end gap-2 my-1 justify-start">
             <div className="max-w-lg p-3 rounded-2xl bg-gray-200 text-gray-800 rounded-bl-lg">
                <p className="text-sm italic animate-pulse">typing...</p>
             </div>
          </div>
        )}
        <div ref={lastMessageRef} />
      </div>
      <ToastContainer />
    </div>
  );
};

export default ChatBody;