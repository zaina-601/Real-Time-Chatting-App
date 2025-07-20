import React from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

const ChatSidebar = ({ users, currentUser, setActiveChat, activeChat }) => {
  const navigate = useNavigate();

  const handleSignOut = () => {
    sessionStorage.removeItem('username');
    socket.disconnect();
    navigate('/');
    socket.connect();
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
              onClick={() => setActiveChat(user.username)} // Yahan username set karein
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