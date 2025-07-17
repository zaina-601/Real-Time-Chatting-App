import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

const Home = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      socket.emit('newUser', username);
      sessionStorage.setItem('username', username);
      navigate('/chat');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md">
        <h2 className="text-2xl mb-4">Enter Chat Room</h2>
        <input
          type="text"
          className="border p-2 w-full mb-4"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit" className="bg-blue-500 text-white p-2 w-full rounded">
          Join
        </button>
      </form>
    </div>
  );
};

export default Home;