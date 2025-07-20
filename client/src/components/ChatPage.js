import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

import ChatSidebar from '../components/ChatSidebar';
import ChatBody from '../components/ChatBody';
import ChatFooter from '../components/ChatFooter';
import { toast } from 'react-toastify';

const ChatPage = () => {
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // Will store the username string
  const navigate = useNavigate();
  const currentUser = sessionStorage.getItem('username');

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    // Sirf yahan par socket events ko manage karein
    const handleConnect = () => socket.emit('newUser', currentUser);

    if (socket.connected) {
      handleConnect();
    }
    socket.on('connect', handleConnect);

    socket.on('userList', (allUsers) => {
      setUsers(allUsers);
    });

    socket.on('userJoined', (newUser) => {
      if (newUser.username !== currentUser) {
        toast.success(`${newUser.username} has joined!`);
      }
    });

    // Cleanup function
    return () => {
      socket.off('connect', handleConnect);
      socket.off('userList');
      socket.off('userJoined');
    };
  }, [currentUser, navigate]);

  return (
    <div className="flex h-screen font-sans">
      <ChatSidebar
        users={users}
        currentUser={currentUser}
        setActiveChat={setActiveChat}
        activeChat={activeChat}
      />
      <div className="flex flex-col flex-grow">
        <header className="bg-gray-700 text-white p-4 text-xl font-bold">
          {activeChat ? `Chat with ${activeChat}` : 'Select a user to chat'}
        </header>
        <ChatBody activeChat={activeChat} />
        <ChatFooter activeChat={activeChat} />
      </div>
    </div>
  );
};

export default ChatPage;