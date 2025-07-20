import React, { useEffect, useState } from 'react';
import ChatSidebar from '../components/ChatSidebar';
import ChatBody from '../components/ChatBody';
import ChatFooter from '../components/ChatFooter';
import socket from '../socket';

const ChatPage = () => {
  const [activeChat, setActiveChat] = useState(null); // { username, id }
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const user = JSON.parse(sessionStorage.getItem('user'));

  useEffect(() => {
    if (!user) return;

    socket.emit('addUser', user);

    socket.on('getUsers', (users) => {
      setOnlineUsers(users.filter(u => u.id !== socket.id));
    });

    socket.on('getMessage', ({ senderId, text }) => {
      setMessages((prev) => [...prev, { fromSelf: false, message: text }]);
    });

    socket.on('typing', (data) => {
      if (data.senderId === activeChat?.id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 1500);
      }
    });

    return () => {
      socket.off('getUsers');
      socket.off('getMessage');
      socket.off('typing');
    };
  }, [activeChat]);

  useEffect(() => {
    if (!activeChat) return;

    // Simulate fetching old messages (replace with API later)
    setMessages([]);
  }, [activeChat]);

  const handleSendMessage = (message) => {
    if (!message || !activeChat) return;

    socket.emit('sendMessage', {
      senderId: socket.id,
      receiverId: activeChat.id,
      text: message,
    });

    setMessages((prev) => [...prev, { fromSelf: true, message }]);
  };

  const handleTyping = () => {
    if (activeChat) {
      socket.emit('typing', {
        senderId: socket.id,
        receiverId: activeChat.id,
      });
    }
  };

  return (
    <div className="chat-page">
      <ChatSidebar
        onlineUsers={onlineUsers}
        setActiveChat={setActiveChat}
        activeChat={activeChat}
      />

      {activeChat ? (
        <div className="chat-section">
          <div className="chat-header">
            <h3>{activeChat.username}</h3>
          </div>

          <ChatBody
            messages={messages}
            isTyping={isTyping}
            currentUser={user.username}
          />

          <ChatFooter
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
          />
        </div>
      ) : (
        <div className="chat-placeholder">
          <h2>Select a user to start chatting</h2>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
