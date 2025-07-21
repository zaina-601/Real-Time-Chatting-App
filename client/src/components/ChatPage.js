import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

import ChatSidebar from '../components/ChatSidebar';
import ChatBody from '../components/ChatBody';
import ChatFooter from '../components/ChatFooter';
import VideoCall from '../components/VideoCall';
import { toast } from 'react-toastify';

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const ChatPage = () => {
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const navigate = useNavigate();
  const currentUser = sessionStorage.getItem('username');

  const [isCalling, setIsCalling] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  const peerConnection = useRef();
  const myVideo = useRef();
  const theirVideo = useRef();
  const callData = useRef({});
  
  // ❗ FIX 1 of 3: Create a ref to queue early ICE candidates
  const iceCandidateQueue = useRef([]);

  const cleanupCall = useCallback(() => {
    console.log("Cleaning up all call resources...");
    if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if(myVideo.current) myVideo.current.srcObject = null;
    if(theirVideo.current) theirVideo.current.srcObject = null;

    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    setIsCalling(false);
    setIncomingCall(null);
    callData.current = {};
    iceCandidateQueue.current = []; // Clear the queue on cleanup
  }, [localStream]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    const handleConnect = () => {
      setIsConnected(true);
      if (socket.connected) socket.emit('newUser', currentUser);
    };
    const handleDisconnect = () => setIsConnected(false);
    const handleUserList = (allUsers) => setUsers(allUsers);

    const handleIncomingCall = ({ from, offer }) => {
      console.log('Received incoming call from', from);
      callData.current = { from, offer };
      setIncomingCall(from);
    };

    const handleCallFinalized = async ({ answer }) => {
      console.log('Call finalized with answer from recipient');
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        
        // ❗ FIX 2 of 3: Process any queued candidates now that the connection is ready
        iceCandidateQueue.current.forEach(candidate => {
            peerConnection.current.addIceCandidate(candidate);
        });
        iceCandidateQueue.current = []; // Clear the queue

        setIsCalling(false);
        setIsCallActive(true);
      }
    };
    
    // ❗ FIX 3 of 3: Modify the ICE candidate handler to use the queue
    const handleIceCandidate = ({ candidate }) => {
      const newIceCandidate = new RTCIceCandidate(candidate);
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        // If ready, add candidate immediately
        peerConnection.current.addIceCandidate(newIceCandidate);
      } else {
        // If not ready, push to queue
        iceCandidateQueue.current.push(newIceCandidate);
      }
    };

    const handleCallEnded = () => {
      toast.info("The call has ended.");
      cleanupCall();
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('userList', handleUserList);
    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-finalized', handleCallFinalized);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call-ended', handleCallEnded);

    if (socket.connected) handleConnect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('userList', handleUserList);
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-finalized', handleCallFinalized);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('call-ended', handleCallEnded);
      cleanupCall();
    };
  }, [currentUser, navigate, cleanupCall]);

  const createPeerConnection = (stream) => {
    peerConnection.current = new RTCPeerConnection(iceServers);
    stream.getTracks().forEach(track => {
      peerConnection.current.addTrack(track, stream);
    });
    peerConnection.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };
  };

  const handleGetUserMediaError = (error) => {
    console.error("getUserMedia error:", error.name, error.message);
    switch(error.name) {
        case 'NotFoundError':
            toast.error("No camera or microphone found on this device.");
            break;
        case 'NotAllowedError':
            toast.error("You denied permission to use the camera and microphone.");
            break;
        case 'NotReadableError':
            toast.error("Your camera or microphone is currently in use by another application.");
            break;
        case 'SecurityError':
            toast.error("Could not access media. Make sure you are on a secure (HTTPS) connection.");
            break;
        default:
            toast.error("Could not access your camera or microphone.");
            break;
    }
    cleanupCall();
  };

  const startCall = async () => {
    if (!activeChat) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        createPeerConnection(stream);
        
        const recipientUser = users.find(u => u.username === activeChat);
        if (!recipientUser) {
            toast.error("Could not find user to call.");
            cleanupCall();
            return;
        }
        
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { to: recipientUser.id, candidate: event.candidate });
            }
        };

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        
        socket.emit('call-user', { to: activeChat, from: { id: socket.id, username: currentUser }, offer });
        setIsCalling(true);
    } catch (error) {
        handleGetUserMediaError(error);
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        createPeerConnection(stream);

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { to: incomingCall.id, candidate: event.candidate });
            }
        };

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(callData.current.offer));

        // Process any queued candidates that arrived early
        iceCandidateQueue.current.forEach(candidate => {
            peerConnection.current.addIceCandidate(candidate);
        });
        iceCandidateQueue.current = []; // Clear queue

        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);

        socket.emit('call-accepted', { to: incomingCall, answer });
        setIsCallActive(true);
        setIncomingCall(null);
    } catch (error) {
        handleGetUserMediaError(error);
    }
  };
  
  const endCall = () => {
    const recipientUsername = activeChat || (incomingCall ? incomingCall.username : null);
    if(recipientUsername) {
      socket.emit('end-call', { to: recipientUsername });
    }
    cleanupCall();
  };

  return (
    <div className="flex h-screen font-sans bg-gray-100">
      {incomingCall && !isCallActive && (
        <div className="absolute top-5 right-5 bg-white p-4 rounded-lg shadow-xl z-50 flex flex-col items-center gap-3 border">
          <p className="font-semibold">{incomingCall.username} is calling...</p>
          <div className="flex gap-4">
            <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">Answer</button>
            <button onClick={() => { setIncomingCall(null); cleanupCall(); }} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">Decline</button>
          </div>
        </div>
      )}

      {isCallActive && (
        <VideoCall
          stream={localStream}
          remoteStream={remoteStream}
          myVideo={myVideo}
          theirVideo={theirVideo}
          onEndCall={endCall}
        />
      )}
      
      <ChatSidebar
        users={users}
        currentUser={currentUser}
        setActiveChat={setActiveChat}
        activeChat={activeChat}
        isConnected={isConnected}
      />
      <div className="flex flex-col flex-grow">
        <header className="bg-white text-gray-800 p-4 text-xl font-bold flex justify-between items-center border-b">
          <span>{activeChat ? `Chat with ${activeChat}` : 'Select a user to chat'}</span>
          {activeChat && (
            <button 
              onClick={startCall} 
              disabled={isCalling || isCallActive}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isCalling ? 'Calling...' : 'Video Call'}
            </button>
          )}
        </header>
        <ChatBody activeChat={activeChat} />
        <ChatFooter activeChat={activeChat} />
      </div>
    </div>
  );
};

export default ChatPage;