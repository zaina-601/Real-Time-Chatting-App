// client/src/components/ChatPage.js
import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import Peer from 'simple-peer';

import ChatSidebar from './ChatSidebar';
import ChatBody from './ChatBody';
import ChatFooter from './ChatFooter';

const ChatPage = () => {
  // This state now holds the full user object: { id, username }
  const [activeChat, setActiveChat] = useState(null);

  // WebRTC State
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState({ id: '', username: '' });
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const currentUser = sessionStorage.getItem('username');

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setStream(stream);
      if (myVideo.current) {
        myVideo.current.srcObject = stream;
      }
    });

    socket.on("hey", (data) => {
      setReceivingCall(true);
      setCallerInfo(data.from);
      setCallerSignal(data.signal);
    });
  }, []);

  const callUser = () => {
    if (!activeChat) return;
    setCallEnded(false);
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("call-user", {
        to: activeChat.id, // Use the ID from the activeChat object
        from: { id: socket.id, username: currentUser },
        signal: data,
      });
    });

    peer.on("stream", (stream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
    });

    socket.on("call-accepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    setReceivingCall(false);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("answer-call", { signal: data, to: callerInfo.id });
    });

    peer.on("stream", (stream) => {
      if(userVideo.current) userVideo.current.srcObject = stream;
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    setCallAccepted(false); // Reset call accepted state
    if (connectionRef.current) {
        connectionRef.current.destroy();
    }
  };

  return (
    <div className="flex h-screen font-sans">
      <ChatSidebar setActiveChat={setActiveChat} />
      <div className="flex flex-col flex-grow">
        <header className="bg-gray-700 text-white p-4 flex justify-between items-center border-b border-gray-700">
          <h1 className="text-xl font-bold">ChatterBox</h1>
          <div className="text-right">
            <div className="text-gray-300">
              {activeChat ? `Chat with ${activeChat.username}` : 'Select a user to chat'}
            </div>
            {activeChat && !callAccepted && (
              <button onClick={callUser} className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded ml-4">
                Call
              </button>
            )}
            {callAccepted && !callEnded && (
              <button onClick={leaveCall} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded ml-4">
                End Call
              </button>
            )}
          </div>
        </header>

        <div className="relative flex-grow bg-gray-100">
          {/* Chat components are always visible */}
          <div className="flex flex-col h-full w-full">
            <ChatBody activeChat={activeChat ? activeChat.username : null} />
            <ChatFooter activeChat={activeChat ? activeChat.username : null} />
          </div>

          {/* Video call elements are overlaid when active */}
          {callAccepted && !callEnded && (
            <div className="absolute top-0 left-0 w-full h-full bg-black z-10 flex items-center justify-center">
              <video playsInline ref={userVideo} autoPlay className="h-full w-full object-cover" />
              <video playsInline muted ref={myVideo} autoPlay className="absolute w-48 h-36 bottom-4 right-4 rounded-lg border-2 border-white z-20" />
            </div>
          )}

          {receivingCall && !callAccepted && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-8 rounded-lg shadow-2xl z-30">
              <h2 className="text-xl mb-4">{callerInfo.username} is calling...</h2>
              <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
                Answer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;