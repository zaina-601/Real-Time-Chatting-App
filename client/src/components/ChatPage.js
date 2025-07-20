import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

import ChatSidebar from '../components/ChatSidebar';
import ChatBody from '../components/ChatBody';
import ChatFooter from '../components/ChatFooter';
import { toast } from 'react-toastify';

const ChatPage = () => {
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const navigate = useNavigate();
  const currentUser = sessionStorage.getItem('username');

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    // Handle connection status
    const handleConnect = () => {
      console.log('Socket connected, emitting newUser');
      setIsConnected(true);
      socket.emit('newUser', currentUser);
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    };

    const handleUserJoinConfirmed = ({ username, users }) => {
      console.log('User join confirmed:', username);
      setUsers(users);
    };

    const handleUserList = (allUsers) => {
      console.log('Received user list:', allUsers);
      setUsers(allUsers);
    };

    const handleUserJoined = (newUser) => {
      if (newUser.username !== currentUser) {
        toast.success(`${newUser.username} has joined!`);
      }
    };

    const handleUserLeft = (leftUser) => {
      if (leftUser.username !== currentUser) {
        toast.info(`${leftUser.username} has left`);
      }
    };

    const handleError = (error) => {
      console.error('Socket error:', error);
      toast.error(error.message || 'Connection error');
    };

    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('userJoinConfirmed', handleUserJoinConfirmed);
    socket.on('userList', handleUserList);
    socket.on('userJoined', handleUserJoined);
    socket.on('userLeft', handleUserLeft);
    socket.on('error', handleError);

    // If already connected, emit newUser immediately
    if (socket.connected) {
      handleConnect();
    }

    // Cleanup function
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('userJoinConfirmed', handleUserJoinConfirmed);
      socket.off('userList', handleUserList);
      socket.off('userJoined', handleUserJoined);
      socket.off('userLeft', handleUserLeft);
      socket.off('error', handleError);
    };
  }, [currentUser, navigate]);

  return (
    <div className="flex h-screen font-sans">
      <ChatSidebar
        users={users}
        currentUser={currentUser}
        setActiveChat={setActiveChat}
        activeChat={activeChat}
        isConnected={isConnected}
      />
      <div className="flex flex-col flex-grow">
        <header className="bg-gray-700 text-white p-4 text-xl font-bold flex justify-between items-center">
          <span>{activeChat ? `Chat with ${activeChat}` : 'Select a user to chat'}</span>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </header>
        <ChatBody activeChat={activeChat} />
        <ChatFooter activeChat={activeChat} />
      </div>
    </div>
  );
};

export default ChatPage;