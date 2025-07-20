import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const typingTimeoutRef = useRef(null);
  const currentUser = sessionStorage.getItem('username');
  const maxRetries = 3;
  const loadingTimeoutMs = 10000; // 10 seconds timeout

  // Memoized load messages function
  const loadMessages = useCallback(() => {
    if (!activeChat || !currentUser || !isConnected) return;
    
    console.log('Fetching messages for:', currentUser, 'and', activeChat);
    setLoading(true);
    setError(null);
    
    // Clear any existing timeout
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    
    // Add timeout for the request
    messageTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      if (retryCount < maxRetries) {
        setError(`Request timeout - retrying... (${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
      } else {
        setError('Failed to load messages - please check your connection');
        setRetryCount(0);
      }
    }, loadingTimeoutMs);

    try {
      socket.emit('getPrivateMessages', { 
        user1: currentUser, 
        user2: activeChat 
      });
    } catch (err) {
      console.error('Error emitting getPrivateMessages:', err);
      setLoading(false);
      setError('Failed to request messages');
    }
  }, [activeChat, currentUser, isConnected, retryCount, maxRetries]);

  // Load messages when activeChat changes
  useEffect(() => {
    console.log('Active chat changed to:', activeChat);
    
    // Reset state
    setMessages([]);
    setTypingUser(null);
    setError(null);
    setRetryCount(0);
    
    // Clear timeouts
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    if (activeChat && currentUser && isConnected) {
      // Small delay to ensure socket is ready
      const loadTimer = setTimeout(() => {
        loadMessages();
      }, 100);
      
      return () => clearTimeout(loadTimer);
    }
  }, [activeChat, currentUser, isConnected, loadMessages]);

  // Retry with exponential backoff
  const retryLoadMessages = useCallback(() => {
    if (retryCount < maxRetries) {
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
      setTimeout(() => {
        loadMessages();
      }, backoffDelay);
    }
  }, [retryCount, maxRetries, loadMessages]);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    const handleConnect = () => {
      console.log('Socket connected in ChatBody');
      setIsConnected(true);
      setError(null);
      
      // Reload messages if we have an active chat
      if (activeChat && currentUser) {
        setTimeout(() => {
          loadMessages();
        }, 500);
      }
    };

    const handleDisconnect = (reason) => {
      console.log('Socket disconnected in ChatBody:', reason);
      setIsConnected(false);
      setLoading(false);
      
      // Clear timeouts
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
      
      // Only show error if not intentionally disconnecting
      if (reason !== 'io client disconnect') {
        setError('Connection lost. Trying to reconnect...');
      }
    };

    const handlePrivateMessages = (history) => {
      console.log('Received message history:', history?.length, 'messages');
      
      // Clear timeout
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
      
      // Validate and set messages
      const validMessages = Array.isArray(history) ? history.filter(msg => 
        msg && msg.text && msg.sender && msg.recipient && msg.timestamp
      ) : [];
      
      setMessages(validMessages);
      setLoading(false);
      setError(null);
      setRetryCount(0);
    };

    const handlePrivateMessage = (data) => {
      console.log('Received new message:', data);
      
      // Validate message data
      if (!data || !data.sender || !data.recipient || !data.text || !data.timestamp) {
        console.warn('Received invalid message data:', data);
        return;
      }
      
      const isForCurrentChat =
        (data.sender === currentUser && data.recipient === activeChat) ||
        (data.sender === activeChat && data.recipient === currentUser);

      if (isForCurrentChat) {
        setMessages((prevMessages) => {
          // Avoid duplicate messages with more robust checking
          const isDuplicate = prevMessages.some(msg => {
            // Check by ID first
            if (msg._id && data._id && msg._id === data._id) {
              return true;
            }
            
            // Check by content and timestamp
            const isSameContent = msg.text === data.text && 
                                msg.sender === data.sender && 
                                msg.recipient === data.recipient;
            
            if (isSameContent) {
              const timeDiff = Math.abs(
                new Date(msg.timestamp).getTime() - 
                new Date(data.timestamp).getTime()
              );
              return timeDiff < 1000; // Consider duplicates if within 1 second
            }
            
            return false;
          });
          
          if (!isDuplicate) {
            return [...prevMessages, data].sort((a, b) => 
              new Date(a.timestamp) - new Date(b.timestamp)
            );
          }
          return prevMessages;
        });
        
        // Clear typing indicator
        setTypingUser(null);
        setError(null);
      } else if (data.sender !== currentUser) {
        // Show notification for messages from other users
        toast.info(`New message from ${data.sender}`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    };

    const handleUserTyping = (sender) => {
      if (sender === activeChat) {
        console.log(sender, 'is typing');
        setTypingUser(sender);
        
        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        // Set timeout to clear typing indicator
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(prev => prev === sender ? null : prev);
        }, 5000);
      }
    };

    const handleUserStoppedTyping = (sender) => {
      if (sender === activeChat) {
        console.log(sender, 'stopped typing');
        setTypingUser(prev => prev === sender ? null : prev);
        
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
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
          // Auto retry for fetch errors
          if (retryCount < maxRetries) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              loadMessages();
            }, 2000);
          }
          return; // Don't show toast for fetch errors that auto-retry
        } else if (error.message === 'Database connection error') {
          errorMessage = 'Server database error - please try again';
        } else if (error.message === 'Invalid user parameters') {
          errorMessage = 'Invalid chat parameters';
        } else {
          errorMessage = error.message || errorMessage;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      setError(errorMessage);
      
      // Only show toast for non-fetch errors
      if (!errorMessage.includes('Failed to load messages')) {
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 5000,
        });
      }
    };

    const handleConnectionConfirmed = (data) => {
      console.log('Connection confirmed:', data);
      setIsConnected(true);
      
      if (data && !data.dbConnected) {
        setError('Server database connection issue');
        toast.warning('Server database connection issue', {
          position: "top-right",
          autoClose: 5000,
        });
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
      
      // Clear timeouts
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [activeChat, currentUser, retryCount, loadMessages]);

  // Auto-retry effect for failed loads
  useEffect(() => {
    if (error && error.includes('retrying') && retryCount > 0 && retryCount <= maxRetries) {
      const timer = setTimeout(() => {
        retryLoadMessages();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [error, retryCount, maxRetries, retryLoadMessages]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (lastMessageRef.current && messages.length > 0) {
      lastMessageRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [messages]);

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Now';
      }
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.warn('Error formatting time:', error);
      return 'Now';
    }
  };

  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return '';
      }
      
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
      console.warn('Error formatting date:', error);
      return '';
    }
  };

  const renderContent = () => {
    if (!isConnected) {
      return (
        <div className="text-center py-8">
          <div className="text-red-500 mb-4">
            <div className="text-lg font-semibold mb-2">🔴 Disconnected</div>
            <div className="text-sm">Lost connection to server</div>
            <div className="text-xs text-gray-500 mt-2">Attempting to reconnect...</div>
          </div>
        </div>
      );
    }

    if (!activeChat) {
      return (
        <div className="text-center py-8">
          <div className="text-gray-500">
            <div className="text-lg font-semibold mb-2">💬 No Chat Selected</div>
            <div className="text-sm">Select a user to start chatting</div>
          </div>
        </div>
      );
    }

    if (!currentUser) {
      return (
        <div className="text-center py-8">
          <div className="text-red-500 mb-4">
            <div className="text-lg font-semibold mb-2">❌ Not Authenticated</div>
            <div className="text-sm">Please log in to start chatting</div>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="text-blue-500 mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <div className="text-sm">Loading messages...</div>
          </div>
        </div>
      );
    }

    if (error && !loading) {
      return (
        <div className="text-center py-8">
          <div className="text-red-500 mb-4">
            <div className="text-lg font-semibold mb-2">⚠️ Error</div>
            <div className="text-sm mb-4">{error}</div>
            {retryCount < maxRetries && (
              <button
                onClick={() => {
                  clearError();
                  loadMessages();
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="text-gray-500">
            <div className="text-lg font-semibold mb-2">📝 No Messages</div>
            <div className="text-sm">Start the conversation with {activeChat}!</div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {messages.map((message, index) => {
          const isOwnMessage = message.sender === currentUser;
          const showDate = index === 0 || 
            formatDate(message.timestamp) !== formatDate(messages[index - 1]?.timestamp);
          
          return (
            <div key={message._id || `${message.sender}-${message.timestamp}-${index}`}>
              {showDate && (
                <div className="text-center text-xs text-gray-500 my-4">
                  {formatDate(message.timestamp)}
                </div>
              )}
              
              <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow ${
                  isOwnMessage 
                    ? 'bg-blue-500 text-white rounded-br-none' 
                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                }`}>
                  <div className="text-sm break-words">
                    {message.text}
                  </div>
                  <div className={`text-xs mt-1 ${
                    isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {typingUser && (
          <div className="flex justify-start mb-2">
            <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg rounded-bl-none">
              <div className="text-sm italic">
                {typingUser} is typing
                <span className="animate-pulse">...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={lastMessageRef} />
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      {activeChat && (
        <div className="bg-white border-b px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {activeChat.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-800">{activeChat}</div>
                <div className="text-xs text-gray-500">
                  {isConnected ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
            
            {error && !loading && (
              <div className="text-red-500 text-xs">
                <button
                  onClick={() => {
                    clearError();
                    loadMessages();
                  }}
                  className="hover:text-red-600 transition-colors"
                  title="Retry loading messages"
                >
                  🔄
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {renderContent()}
      </div>

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
};

export default ChatBody;