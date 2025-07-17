import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import { toast } from 'react-toastify';

const ChatSidebar = ({ setActiveChat }) => {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();
  const currentUser = sessionStorage.getItem('username');

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    socket.on('userList', (initialUsers) => {
      setUsers(initialUsers);
    });

    socket.on('userJoined', (newUser) => {
      toast.success(`${newUser.username} has joined!`);
      setUsers((prevUsers) => [...prevUsers, newUser]);
    });

    socket.on('userLeft', (leftUsername) => {
      toast.error(`${leftUsername} has left.`);
      setActiveChat(prev => (prev === leftUsername ? null : prev));
      setUsers((prevUsers) => prevUsers.filter(user => user.username !== leftUsername));
    });

    socket.emit('newUser', currentUser);

    return () => {
      socket.off('userList');
      socket.off('userJoined');
      socket.off('userLeft');
    };
  }, [currentUser, navigate, setActiveChat]);

  const handleSignOut = () => {
    sessionStorage.removeItem('username');
    socket.disconnect();
    socket.connect();
    navigate('/');
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
              className="p-4 hover:bg-gray-700 cursor-pointer"
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