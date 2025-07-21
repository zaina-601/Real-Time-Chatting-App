import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

import ChatSidebar from '../components/ChatSidebar';
import ChatBody from '../components/ChatBody';
import ChatFooter from '../components/ChatFooter';
import VideoCall from '../components/VideoCall';
import AudioCall from '../components/AudioCall';
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

  // --- Call States ---
  const [isCalling, setIsCalling] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callType, setCallType] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const peerConnection = useRef();
  const myVideo = useRef();
  const theirVideo = useRef();
  const iceCandidateQueue = useRef([]);

  const cleanupCall = useCallback(() => {
    console.log("Cleaning up all call resources...");
    if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
    }
    setLocalStream(currentStream => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      return null;
    });

    setRemoteStream(null);
    setIsCallActive(false);
    setIsCalling(false);
    setIncomingCall(null);
    setCallType(null);
    setIsMuted(false);
    iceCandidateQueue.current = [];
  }, []);
  useEffect(() => {
    if (!currentUser) navigate('/');

    const handleConnect = () => {
      setIsConnected(true);
      if (socket.connected) socket.emit('newUser', currentUser);
    };
    const handleDisconnect = () => setIsConnected(false);
    const handleUserList = (allUsers) => setUsers(allUsers);

    const handleIncomingCall = ({ from, offer, callType }) => {
      setIncomingCall({ from, offer, callType });
    };
    const handleCallFinalized = async ({ answer }) => {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        iceCandidateQueue.current.forEach(candidate => peerConnection.current.addIceCandidate(candidate));
        iceCandidateQueue.current = [];
        setIsCalling(false);
        setIsCallActive(true);
      }
    };
    const handleIceCandidate = ({ candidate }) => {
      const newIceCandidate = new RTCIceCandidate(candidate);
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        peerConnection.current.addIceCandidate(newIceCandidate);
      } else {
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

  const getMedia = (type) => {
    const constraints = type === 'video' 
      ? { video: true, audio: true }
      : { video: false, audio: true };
    return navigator.mediaDevices.getUserMedia(constraints);
  };

  const createPeerConnection = (stream) => {
    peerConnection.current = new RTCPeerConnection(iceServers);
    stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));
    peerConnection.current.ontrack = (event) => setRemoteStream(event.streams[0]);
  };

  const startCall = async (type) => {
    if (!activeChat) return;
    setCallType(type);
    try {
        const stream = await getMedia(type);
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
        socket.emit('call-user', { to: activeChat, from: { id: socket.id, username: currentUser }, offer, callType: type });
        setIsCalling(true);
    } catch (error) {
        handleGetUserMediaError(error);
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    setCallType(incomingCall.callType);
    try {
        const stream = await getMedia(incomingCall.callType);
        setLocalStream(stream);
        createPeerConnection(stream);
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { to: incomingCall.from.id, candidate: event.candidate });
            }
        };
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
        iceCandidateQueue.current.forEach(candidate => peerConnection.current.addIceCandidate(candidate));
        iceCandidateQueue.current = [];
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit('call-accepted', { to: incomingCall.from, answer });
        setIsCallActive(true);
        setIncomingCall(null);
    } catch (error) {
        handleGetUserMediaError(error);
    }
  };
  
  const endCall = () => {
    const recipientUsername = activeChat || (incomingCall ? incomingCall.from.username : null);
    if(recipientUsername) {
      socket.emit('end-call', { to: recipientUsername });
    }
    cleanupCall();
  };

  const handleToggleMute = () => {
    setLocalStream(currentStream => {
      if (currentStream) {
        currentStream.getAudioTracks().forEach(track => {
          track.enabled = !track.enabled;
          setIsMuted(!track.enabled);
        });
      }
      return currentStream;
    });
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

  return (
    <div className="flex h-screen font-sans bg-gray-100">
      {incomingCall && !isCallActive && (
        <div className="absolute top-5 right-5 bg-white p-4 rounded-lg shadow-xl z-50 flex flex-col items-center gap-3 border">
          <p className="font-semibold">{incomingCall.from.username} is starting an {incomingCall.callType} call...</p>
          <div className="flex gap-4">
            <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">Answer</button>
            <button onClick={() => { setIncomingCall(null); cleanupCall(); }} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">Decline</button>
          </div>
        </div>
      )}

      {isCallActive && callType === 'video' && (
        <VideoCall
          stream={localStream}
          remoteStream={remoteStream}
          myVideo={myVideo}
          theirVideo={theirVideo}
          onEndCall={endCall}
        />
      )}
      {isCallActive && callType === 'audio' && (
        <AudioCall
          activeChat={activeChat || (incomingCall ? incomingCall.from.username : '')}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onEndCall={endCall}
        />
      )}
      
      <ChatSidebar users={users} currentUser={currentUser} setActiveChat={setActiveChat} activeChat={activeChat} isConnected={isConnected} />
      <div className="flex flex-col flex-grow">
        <header className="bg-white text-gray-800 p-4 text-xl font-bold flex justify-between items-center border-b">
          <span>{activeChat ? `Chat with ${activeChat}` : 'Select a user to chat'}</span>
          {activeChat && (
            <div className="flex gap-3">
              <button onClick={() => startCall('audio')} disabled={isCalling || isCallActive} className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400" title="Start Audio Call">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
              </button>
              <button onClick={() => startCall('video')} disabled={isCalling || isCallActive} className="p-2 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400" title="Start Video Call">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              </button>
            </div>
          )}
        </header>
        <ChatBody activeChat={activeChat} />
        <ChatFooter activeChat={activeChat} />
      </div>
    </div>
  );
};

export default ChatPage;