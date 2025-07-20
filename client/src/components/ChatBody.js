import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChatBody = ({ activeChat }) => {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastMessageRef = useRef(null);
  const currentUser = sessionStorage.getItem('username');

  // Load messages when activeChat changes
  useEffect(() => {
    console.log('Active chat changed to:', activeChat);
    setMessages([]);
    setTypingUser(null);
    
    if (activeChat && currentUser) {
      console.log('Fetching messages for:', currentUser, 'and', activeChat);
      setLoading(true);
      socket.emit('getPrivateMessages', { user1: currentUser, user2: activeChat });
    }
  }, [activeChat, currentUser]);

  // Set up socket event listeners
  useEffect(() => {
    const handlePrivateMessages = (history) => {
      console.log('Received message history:', history);
      setMessages(history);
      setLoading(false);
    };

    const handlePrivateMessage = (data) => {
      console.log('Received new message:', data);
      
      const isForCurrentChat =
        (data.sender === currentUser && data.recipient === activeChat) ||
        (data.sender === activeChat && data.recipient === currentUser);

      if (isForCurrentChat) {
        setMessages((prevMessages) => {
          // Avoid duplicate messages by checking if message already exists
          const isDuplicate = prevMessages.some(msg => 
            msg._id === data._id || 
            (msg.text === data.text && 
             msg.sender === data.sender && 
             msg.recipient === data.recipient &&
             Math.abs(new Date(msg.timestamp) - new Date(data.timestamp)) < 1000)
          );
          
          if (!isDuplicate) {
            return [...prevMessages, data];
          }
          return prevMessages;
        });
        setTypingUser(null);
      } else if (data.sender !== currentUser) {
        toast.info(`New message from ${data.sender}`);
      }
    };

    const handleUserTyping = (sender) => {
      if (sender === activeChat) {
        console.log(sender, 'is typing');
        setTypingUser(sender);
      }
    };

    const handleUserStoppedTyping = (sender) => {
      if (sender === activeChat) {
        console.log(sender, 'stopped typing');
        setTypingUser(null);
      }
    };

    const handleError = (error) => {
      console.error('Socket error in ChatBody:', error);
      toast.error(error.message || 'Something went wrong');
      setLoading(false);
    };

    // Add event listeners
    socket.on('privateMessages', handlePrivateMessages);
    socket.on('receivePrivateMessage', handlePrivateMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);
    socket.on('error', handleError);

    // Cleanup function
    return () => {
      socket.off('privateMessages', handlePrivateMessages);
      socket.off('receivePrivateMessage', handlePrivateMessage);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
      socket.off('error', handleError);
    };
  }, [activeChat, currentUser]);

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-grow p-4 overflow-y-auto bg-gray-100">
        <ToastContainer position="top-right" autoClose={3000} />
        
        {loading && (
          <div className="text-center text-gray-500 py-4">
            Loading messages...
          </div>
        )}
        
        {!loading && messages.length === 0 && activeChat && (
          <div className="text-center text-gray-500 py-8">
            No messages yet. Start the conversation!
          </div>
        )}

        {messages.map((msg, index) => (
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