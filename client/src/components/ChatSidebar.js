import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import { toast } from 'react-toastify';

const ChatSidebar = ({ setActiveChat, activeChat }) => {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();
  const currentUser = sessionStorage.getItem('username');
  const announcedUsers = useRef(new Set());

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    const handleConnect = () => {
      console.log("🔗 Connected to socket with id:", socket.id);
      socket.emit('newUser', currentUser);
    };

    const handleUserList = (allUsers) => {
      setUsers(allUsers);
    };

    const handleUserJoined = (newUser) => {
      if (newUser.username !== currentUser && !announcedUsers.current.has(newUser.username)) {
        toast.success(`${newUser.username} has joined!`);
        announcedUsers.current.add(newUser.username);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('userList', handleUserList);
    socket.on('userJoined', handleUserJoined);

    // In case already connected, emit immediately
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('userList', handleUserList);
      socket.off('userJoined', handleUserJoined);
    };
  }, [currentUser, navigate]);

  const handleSignOut = () => {
    sessionStorage.removeItem('username');
    socket.disconnect();
    navigate('/');
    socket.connect(); // Reconnect after navigating away
  };

  return (
    <div className="w-1/4 bg-gray-800 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">Online Users</h2>
      </div>
      <ul className="flex-grow overflow-y-auto">
        {users
          .filter(user => user.username !== currentUser)
          .map((user) => (
            <li
              key={user.id}
              className={`p-4 cursor-pointer ${activeChat === user.username ? 'bg-gray-600' : 'hover:bg-gray-700'}`}
              onClick={() => setActiveChat(user.username)}
            >
              {user.username}
            </li>
          ))}
      </ul>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleSignOut}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ChatSidebar;
