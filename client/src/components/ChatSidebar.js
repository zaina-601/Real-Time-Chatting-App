// src/components/ChatSidebar.js
import React, { useState, useEffect } from 'react';
import socket from '../socket';

const ChatSidebar = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    socket.on('userList', (userList) => {
      setUsers(userList);
    });

    return () => {
      socket.off('userList');
    };
  }, []);

  return (
    <div className="w-1/4 bg-gray-200 p-4">
      <h2 className="text-xl font-bold mb-4">Online Users</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id} className="mb-2 p-2 bg-gray-300 rounded">
            {user.username}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChatSidebar;