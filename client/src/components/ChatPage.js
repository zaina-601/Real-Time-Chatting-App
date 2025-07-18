import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import Peer from 'simple-peer'; 

import ChatSidebar from './ChatSidebar';
import ChatBody from './ChatBody';
import ChatFooter from './ChatFooter';

const ChatPage = () => {
  const [activeChat, setActiveChat] = useState(null);

  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState('');
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const currentUser = sessionStorage.getItem('username');
  const activeChatSocketId = useRef(''); // To store the socket ID of the active chat user

  useEffect(() => {
    // Get user's camera and microphone access
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setStream(stream);
      if (myVideo.current) {
        myVideo.current.srcObject = stream;
      }
    });

    socket.on("userList", (users) => {
        // Find the socket ID for the current active chat user if they exist
        const activeUser = users.find(u => u.username === activeChat);
        if(activeUser) activeChatSocketId.current = activeUser.id;
    });

    socket.on("hey", (data) => {
      setReceivingCall(true);
      setCaller(data.from.username);
      setCallerSignal(data.signal);
    });
  }, [activeChat]);

  const callUser = (username) => {
    setCallEnded(false);
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("call-user", {
        to: activeChatSocketId.current, // We need the socket ID to call
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
      const callerSocket = // We need to find the caller's socket ID
      socket.emit("answer-call", { signal: data, to: caller.id });
    });

    peer.on("stream", (stream) => {
      userVideo.current.srcObject = stream;
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) {
        connectionRef.current.destroy();
    }
    // Optionally, stop media tracks to turn off the camera light
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
     // Re-request media for future calls
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(newStream => {
        setStream(newStream);
        if (myVideo.current) {
            myVideo.current.srcObject = newStream;
        }
    });
  };

  return (
    <div className="flex h-screen font-sans">
      <ChatSidebar setActiveChat={setActiveChat} />
      <div className="flex flex-col flex-grow">
        <header className="bg-gray-700 text-white p-4 flex justify-between items-center border-b border-gray-700">
          <h1 className="text-xl font-bold">ChatterBox</h1>
          <div className="text-right">
            <div className="text-gray-300">
                {activeChat ? `Chat with ${activeChat}` : 'Select a user to chat'}
            </div>
            {/* Call Button */}
            {activeChat && !callAccepted && (
              <button onClick={() => callUser(activeChat)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded ml-4">
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

        {/* Video Call Container */}
        <div className="relative flex-grow">
            <div className="absolute top-0 left-0 w-full h-full z-10">
                {/* Remote Video */}
                {callAccepted && !callEnded && userVideo.current && <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />}
                {/* My Video */}
                {stream && myVideo.current && <video playsInline muted ref={myVideo} autoPlay className="absolute w-48 h-36 bottom-4 right-4 rounded-lg border-2 border-white" />}
            </div>

            {/* Chat components are now underneath the video call */}
            <div className="flex flex-col h-full absolute w-full z-0">
                <ChatBody activeChat={activeChat} />
                <ChatFooter activeChat={activeChat} />
            </div>

             {/* Incoming Call Notification */}
            {receivingCall && !callAccepted && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-8 rounded-lg shadow-2xl z-20">
                    <h2 className="text-xl mb-4">{caller} is calling...</h2>
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