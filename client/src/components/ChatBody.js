import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChatBody = ({ activeChat }) => {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const lastMessageRef = useRef(null);
  const messageTimeoutRef = useRef(null);
  const currentUser = sessionStorage.getItem('username');
  const maxRetries = 3;

  // Load messages when activeChat changes
  useEffect(() => {
    console.log('Active chat changed to:', activeChat);
    setMessages([]);
    setTypingUser(null);
    setError(null);
    setRetryCount(0);
    
    // Clear any existing timeout
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    
    if (activeChat && currentUser && isConnected) {
      loadMessages();
    }
  }, [activeChat, currentUser, isConnected]);

  const loadMessages = () => {
    if (!activeChat || !currentUser) return;
    
    console.log('Fetching messages for:', currentUser, 'and', activeChat);
    setLoading(true);
    setError(null);
    
    // Clear any existing timeout
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    
    // Add timeout for the request
    messageTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      if (retryCount < maxRetries) {
        setError(`Request timeout - retrying... (${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => loadMessages(), 2000);
      } else {
        setError('Failed to load messages - please check your connection');
      }
    }, 15000);

    socket.emit('getPrivateMessages', { user1: currentUser, user2: activeChat });
  };

  const retryLoadMessages = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setTimeout(() => {
        loadMessages();
      }, 1000 * retryCount);
    }
  };

  const clearError = () => {
    setError(null);
    setRetryCount(0);
  };

  // Set up socket event listeners
  useEffect(() => {
    const handleConnect = () => {
      console.log('Socket connected in ChatBody');
      setIsConnected(true);
      setError(null);
      // Reload messages if we have an active chat
      if (activeChat && currentUser) {
        setTimeout(() => loadMessages(), 500);
      }
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected in ChatBody');
      setIsConnected(false);
      setError('Connection lost. Trying to reconnect...');
      setLoading(false);
    };

    const handlePrivateMessages = (history) => {
      console.log('Received message history:', history);
      
      // Clear timeout
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
      
      setMessages(Array.isArray(history) ? history : []);
      setLoading(false);
      setError(null);
      setRetryCount(0);
    };

    const handlePrivateMessage = (data) => {
      console.log('Received new message:', data);
      
      if (!data || !data.sender || !data.recipient || !data.text) {
        console.warn('Received invalid message data:', data);
        return;
      }
      
      const isForCurrentChat =
        (data.sender === currentUser && data.recipient === activeChat) ||
        (data.sender === activeChat && data.recipient === currentUser);

      if (isForCurrentChat) {
        setMessages((prevMessages) => {
          // Avoid duplicate messages
          const isDuplicate = prevMessages.some(msg => 
            msg._id === data._id || 
            (msg.text === data.text && 
             msg.sender === data.sender && 
             msg.recipient === data.recipient &&
             Math.abs(new Date(msg.timestamp) - new Date(data.timestamp)) < 2000)
          );
          
          if (!isDuplicate) {
            return [...prevMessages, data];
          }
          return prevMessages;
        });
        setTypingUser(null);
        setError(null);
      } else if (data.sender !== currentUser) {
        // Show notification for messages from other users
        toast.info(`New message from ${data.sender}`, {
          position: "top-right",
          autoClose: 3000,
        });
      }
    };

    const handleUserTyping = (sender) => {
      if (sender === activeChat) {
        console.log(sender, 'is typing');
        setTypingUser(sender);
        
        // Clear typing indicator after 5 seconds
        setTimeout(() => {
          setTypingUser(prev => prev === sender ? null : prev);
        }, 5000);
      }
    };

    const handleUserStoppedTyping = (sender) => {
      if (sender === activeChat) {
        console.log(sender, 'stopped typing');
        setTypingUser(prev => prev === sender ? null : prev);
      }
    };

    const handleError = (error) => {
      console.error('Socket error in ChatBody:', error);
      
      // Clear timeout
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
      
      setLoading(false);
      
      let errorMessage = 'Something went wrong';
      if (error && typeof error === 'object') {
        if (error.message === 'Failed to fetch messages') {
          errorMessage = 'Failed to load messages';
          setError(errorMessage);
          return; // Don't show toast for fetch errors
        } else if (error.message === 'Database connection error') {
          errorMessage = 'Server database error - please try again';
        } else if (error.message === 'Invalid user parameters') {
          errorMessage = 'Invalid chat parameters';
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      setError(errorMessage);
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
      });
    };

    const handleConnectionConfirmed = (data) => {
      console.log('Connection confirmed:', data);
      setIsConnected(true);
      if (!data.dbConnected) {
        setError('Server database connection issue');
      }
    };

    // Add event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('privateMessages', handlePrivateMessages);
    socket.on('receivePrivateMessage', handlePrivateMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);
    socket.on('error', handleError);
    socket.on('connectionConfirmed', handleConnectionConfirmed);

    // Set initial connection state
    setIsConnected(socket.connected);

    // Cleanup function
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('privateMessages', handlePrivateMessages);
      socket.off('receivePrivateMessage', handlePrivateMessage);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
      socket.off('error', handleError);
      socket.off('connectionConfirmed', handleConnectionConfirmed);
      
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, [activeChat, currentUser, retryCount]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return 'Now';
    }
  };

  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      return '';
    }
  };

  const renderContent = () => {
    if (!isConnected) {
      return (
        <div className="text-center py-8">
          <div className="text-red-500 mb-4">
            <div className="text-lg font-semibold mb-2">🔴 Disconnected</div>
            <div className="text-sm">Trying to reconnect...</div>
          </div>
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="text-center text-gray-500 py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <div>Loading messages...</div>
          {retryCount > 0 && (
            <div className="text-sm mt-2">Retry attempt {retryCount}/{maxRetries}</div>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <div className="text-red-500 mb-4">
            <div className="text-lg font-semibold mb-2">⚠️ Error</div>
            <div className="text-sm mb-4">{error}</div>
          </div>
          {retryCount < maxRetries ? (
            <div className="space-y-2">
              <button
                onClick={retryLoadMessages}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors mr-2"
                disabled={loading}
              >
                Retry ({retryCount + 1}/{maxRetries})
              </button>
              <button
                onClick={clearError}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
              >
                Clear Error
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
              >
                Refresh Page
              </button>
              <div className="text-gray-500 text-sm mt-2">
                Please check your internet connection
              </div>
            </div>
          )}
        </div>
      );
    }

    if (!activeChat) {
      return (
        <div className="text-center text-gray-500 py-8">
          <div className="text-6xl mb-4">💬</div>
          <div className="text-lg mb-2">Welcome to Chat!</div>
          <div>Select a user from the sidebar to start chatting</div>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-4">👋</div>
          <div className="text-lg mb-2">No messages yet</div>
          <div>Start the conversation with {activeChat}!</div>
        </div>
      );
    }

    return messages.map((msg, index) => (
      <div 
        key={msg._id || `${msg.sender}-${msg.timestamp}-${index}`} 
        className={`mb-4 flex ${msg.sender === currentUser ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`p-3 rounded-lg max-w-md break-words ${
          msg.sender === currentUser 
            ? 'bg-blue-500 text-white' 
            : 'bg-white shadow border'
        }`}>
          {msg.sender !== currentUser && (
            <p className="font-bold text-sm text-blue-600 mb-1">{msg.sender}</p>
          )}
          <p className="whitespace-pre-wrap">{msg.text}</p>
          <p className={`text-xs mt-1 opacity-70 text-right ${
            msg.sender === currentUser ? 'text-blue-200' : 'text-gray-500'
          }`}>
            {formatTime(msg.timestamp)}
          </p>
        </div>
      </div>
    ));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-grow p-4 overflow-y-auto bg-gray-100">
        <ToastContainer 
          position="top-right" 
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
        
        {renderContent()}
        <div ref={lastMessageRef} />
      </div>
      
      <div className="h-6 px-4 text-gray-500 italic">
        {typingUser && `${typingUser} is typing...`}
      </div>
    </div>
  );
};

export default ChatBody;