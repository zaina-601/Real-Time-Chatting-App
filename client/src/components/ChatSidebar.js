import React from 'react';
import { useNavigate } from 'react-router-dom';

const ChatSidebar = ({ users, currentUser, setActiveChat, activeChat, isConnected }) => {
  const navigate = useNavigate();

  const handleSignOut = () => {
    sessionStorage.removeItem('username');
    navigate('/');
  };

  const handleUserClick = (username) => {
    console.log('User clicked:', username);
    setActiveChat(username);
  };

  const otherUsers = users.filter(user => user.username !== currentUser);

  return (
    <div className="w-1/4 bg-gray-800 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">Online Users</h2>
        <p className="text-sm text-gray-400">
          Connected: {isConnected ? '✅' : '❌'} | Users: {otherUsers.length}
        </p>
      </div>
      
      <div className="flex-grow overflow-y-auto">
        {otherUsers.length === 0 ? (
          <div className="p-4 text-gray-400 text-center">
            {isConnected ? 'No other users online' : 'Connecting...'}
          </div>
        ) : (
          otherUsers.map((user) => (
            <div
              key={user.username}
              className={`p-3 cursor-pointer border-b border-gray-700 hover:bg-gray-700 transition-colors ${
                activeChat === user.username ? 'bg-gray-600' : ''
              }`}
              onClick={() => handleUserClick(user.username)}
            >
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="font-medium">{user.username}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-4 border-t border-gray-700">
        <div className="mb-2 text-sm text-gray-400">
          Logged in as: <span className="text-white font-medium">{currentUser}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ChatSidebar;