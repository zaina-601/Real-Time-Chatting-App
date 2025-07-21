import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { toast } from 'react-toastify';

const ChatFooter = ({ activeChat }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [sendError, setSendError] = useState(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const sendTimeoutRef = useRef(null);

  useEffect(() => {
    setMessage('');
    setIsSending(false);
    setSendError(null);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      isTypingRef.current = false;
    }
  }, [activeChat]);

  useEffect(() => {
    const handleConnect = () => {
      console.log('Socket connected in ChatFooter');
      setIsConnected(true);
      setSendError(null);
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected in ChatFooter');
      setIsConnected(false);
      setIsSending(false);
    };

    const handleMessageSent = ({ success, messageId }) => {
      console.log('Message sent confirmation:', success, messageId);
      setIsSending(false);
      setSendError(null);
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
    };

    const handleError = (error) => {
      console.error('Socket error in ChatFooter:', error);
      setIsSending(false);
      
      let errorMessage = 'Failed to send message';
      if (error && typeof error === 'object') {
        if (error.message === 'Database connection error') {
          errorMessage = 'Server connection issue';
        } else if (error.message && error.message.includes('validation')) {
          errorMessage = 'Invalid message format';
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      setSendError(errorMessage);
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 4000,
      });

      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('messageSent', handleMessageSent);
    socket.on('error', handleError);

    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('messageSent', handleMessageSent);
      socket.off('error', handleError);
      
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || !activeChat || isSending || !isConnected) {
      return;
    }

    const username = sessionStorage.getItem('username');
    if (!username) {
      toast.error('Session expired. Please refresh the page.');
      return;
    }

    if (message.trim().length > 1000) {
      toast.error('Message is too long (max 1000 characters)');
      return;
    }

    console.log('Sending message:', message, 'from', username, 'to', activeChat);
    
    setSendError(null);
    setIsSending(true);
    
    const messageData = { 
      text: message.trim(), 
      sender: username, 
      recipient: activeChat 
    };
    
    try {
      socket.emit('sendPrivateMessage', messageData);
      setMessage('');

      if (isTypingRef.current) {
        socket.emit('stopTyping', { sender: username, recipient: activeChat });
        isTypingRef.current = false;
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      sendTimeoutRef.current = setTimeout(() => {
        setIsSending(false);
        setSendError('Message send timeout');
        toast.error('Message send timeout - please try again');
      }, 10000);
      
    } catch (error) {
      console.error('Error sending message:', error);
      setIsSending(false);
      setSendError('Failed to send message');
      toast.error('Failed to send message');
    }
  };
  
  const handleTyping = (e) => {
    const newValue = e.target.value;
    setMessage(newValue);
    setSendError(null); 
    
    if (!activeChat || !isConnected) return;
    
    const username = sessionStorage.getItem('username');
    if (!username) return;

    if (!isTypingRef.current && newValue.trim()) {
      socket.emit('typing', { sender: username, recipient: activeChat });
      isTypingRef.current = true;
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (newValue.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          socket.emit('stopTyping', { sender: username, recipient: activeChat });
          isTypingRef.current = false;
        }
        typingTimeoutRef.current = null;
      }, 2000);
    } else {
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

  const getButtonText = () => {
    if (!isConnected) return 'Disconnected';
    if (isSending) return 'Sending...';
    return 'Send';
  };

  const getButtonColor = () => {
    if (!isConnected) return 'bg-red-500';
    if (isSending) return 'bg-gray-500';
    return 'bg-blue-500 hover:bg-blue-600';
  };

  const isDisabled = !activeChat || !message.trim() || isSending || !isConnected;

  return (
    <div className="p-4 bg-gray-200 border-t border-gray-300">
      {sendError && (
        <div className="mb-2 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
          {sendError}
          <button
            onClick={() => setSendError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}
      
      {!isConnected && (
        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-400 text-yellow-700 text-sm rounded">
          ⚠️ Connection lost. Trying to reconnect...
        </div>
      )}
      
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder={activeChat ? `Message ${activeChat}...` : "Select a user to start chatting"}
          value={message}
          onChange={handleTyping}
          onKeyPress={handleKeyPress}
          disabled={!activeChat || !isConnected}
          maxLength={1000}
          autoComplete="off"
        />
        <button
          type="submit"
          className={`px-6 py-3 text-white rounded-lg transition-colors font-medium min-w-[80px] disabled:cursor-not-allowed disabled:opacity-50 ${getButtonColor()}`}
          disabled={isDisabled}
        >
          {getButtonText()}
        </button>
      </form>
      
      {message.length > 900 && (
        <div className="mt-1 text-xs text-gray-500 text-right">
          {message.length}/1000 characters
        </div>
      )}
      
      {!activeChat && (
        <div className="mt-2 text-sm text-gray-500 text-center">
          Select a user from the sidebar to start chatting
        </div>
      )}
    </div>
  );
};

export default ChatFooter;