import React from 'react';
import ChatSidebar from './ChatSidebar';
import ChatBody from './ChatBody';
import ChatFooter from './ChatFooter';

const ChatPage = () => {
  return (
    <div className="flex h-screen">
      <ChatSidebar />
      <div className="flex flex-col flex-grow">
        <ChatBody />
        <ChatFooter />
      </div>
    </div>
  );
};

export default ChatPage;