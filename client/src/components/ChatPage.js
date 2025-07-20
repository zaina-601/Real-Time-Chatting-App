import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import { toast } from 'react-toastify';

import ChatSidebar from './ChatSidebar';
import ChatBody from './ChatBody';
import ChatFooter from './ChatFooter';

const ChatPage = () => {
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // Will be a user object: {id, username}
  const navigate = useNavigate();
  const currentUser = sessionStorage.getItem('username');
  const announcedUsers = useRef(new Set());

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    // --- FINAL FIX: State management sirf yahan hoga ---
    const handleConnect = () => socket.emit('newUser', currentUser);

    if (socket.connected) {
      handleConnect();
    }
    socket.on('connect', handleConnect);

    socket.on('userList', (allUsers) => {
      setUsers(allUsers);
    });

    socket.on('userJoined', (newUser) => {
      if (newUser.username !== currentUser && !announcedUsers.current.has(newUser.username)) {
        toast.success(`${newUser.username} has joined!`);
        announcedUsers.current.add(newUser.username);
      }
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('userList');
      socket.off('userJoined');
    };
  }, [currentUser, navigate]);

  return (
    <div className="flex h-screen font-sans">
      {/* --- FINAL FIX: Sidebar ko props de rahe hain, wo khud state manage nahi karega --- */}
      <ChatSidebar
        users={users}
        currentUser={currentUser}
        setActiveChat={setActiveChat}
        activeChat={activeChat}
      />
      <div className="flex flex-col flex-grow">
        <header className="bg-gray-700 text-white p-4 text-xl font-bold">
          {activeChat ? `Chat with ${activeChat.username}` : 'Select a user to chat'}
        </header>

        <ChatBody activeChat={activeChat?.username || null} />
        <ChatFooter activeChat={activeChat?.username || null} />
      </div>
    </div>
  );
};

export default ChatPage;