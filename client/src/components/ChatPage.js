import React, { useState } from 'react';
import ChatSidebar from './ChatSidebar';
import ChatBody from './ChatBody';
import ChatFooter from './ChatFooter';

const ChatPage = () => {
  const [activeChat, setActiveChat] = useState(null);

  return (
    <div className="flex h-screen font-sans">
      <ChatSidebar setActiveChat={setActiveChat} />
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