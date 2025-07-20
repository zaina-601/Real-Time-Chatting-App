import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';

const ChatFooter = ({ activeChat }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    setMessage('');
    setIsSending(false);
    
    // Clear typing timeout when activeChat changes
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      isTypingRef.current = false;
    }
  }, [activeChat]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || !activeChat || isSending) {
      return;
    }

    const username = sessionStorage.getItem('username');
    if (!username) {
      console.error('No username found');
      return;
    }

    console.log('Sending message:', message, 'from', username, 'to', activeChat);
    
    setIsSending(true);
    
    const messageData = { 
      text: message.trim(), 
      sender: username, 
      recipient: activeChat 
    };
    
    try {
      socket.emit('sendPrivateMessage', messageData);
      setMessage('');
      
      // Clear typing indicator
      if (isTypingRef.current) {
        socket.emit('stopTyping', { sender: username, recipient: activeChat });
        isTypingRef.current = false;
      }
      
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      // Reset sending state after a brief delay
      setTimeout(() => {
        setIsSending(false);
      }, 500);
    }
  };
  
  const handleTyping = (e) => {
    const newValue = e.target.value;
    setMessage(newValue);
    
    if (!activeChat) return;
    
    const username = sessionStorage.getItem('username');
    if (!username) return;

    // Only emit typing if not already typing
    if (!isTypingRef.current && newValue.trim()) {
      socket.emit('typing', { sender: username, recipient: activeChat });
      isTypingRef.current = true;
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing
    if (newValue.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          socket.emit('stopTyping', { sender: username, recipient: activeChat });
          isTypingRef.current = false;
        }
        typingTimeoutRef.current = null;
      }, 2000);
    } else {
      // If message is empty, immediately stop typing
      if (isTypingRef.current) {
        socket.emit('stopTyping', { sender: username, recipient: activeChat });
        isTypingRef.current = false;
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="p-4 bg-gray-200 border-t border-gray-300">
      <form onSubmit={handleSendMessage} className="flex">
        <input
          type="text"
          placeholder={activeChat ? `Message ${activeChat}` : 'Select a user to message'}
          className="flex-grow p-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          value={message}
          onChange={handleTyping}
          onKeyPress={handleKeyPress}
          disabled={!activeChat || isSending}
          maxLength={1000}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[80px] transition-colors"
          disabled={!activeChat || !message.trim() || isSending}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>
      {message.length > 800 && (
        <div className="text-xs text-gray-500 mt-1 text-right">
          {message.length}/1000 characters
        </div>
      )}
    </div>
  );
};

export default ChatFooter;