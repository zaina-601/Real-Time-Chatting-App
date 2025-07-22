import React, { useEffect } from 'react';

const AudioCall = ({ activeChat, onToggleMute, isMuted, onEndCall, theirVideo, remoteStream }) => {
  
  useEffect(() => {
    if (theirVideo.current && remoteStream) {
      theirVideo.current.srcObject = remoteStream;
    }
  }, [remoteStream, theirVideo]);

  return (
    <div className="fixed inset-0 bg-gray-800 flex flex-col items-center justify-center z-50 text-white">
      {/* 
        This invisible audio element plays the other person's voice.
        It uses the 'theirVideo' ref passed down from the parent.
      */}
      <audio ref={theirVideo} autoPlay playsInline />

      <div className="flex flex-col items-center gap-6">
        <div className="w-40 h-40 bg-indigo-500 rounded-full flex items-center justify-center border-4 border-indigo-400">
          <span className="text-6xl font-bold">{activeChat ? activeChat.charAt(0).toUpperCase() : '?'}</span>
        </div>
        <div className="text-center">
          <p className="text-3xl font-semibold">{activeChat}</p>
          <p className="text-lg text-gray-300 mt-2">Audio Call Connected...</p>
        </div>
      </div>
      <div className="absolute bottom-10 flex items-center gap-8">
        <button
          onClick={onToggleMute}
          className={`w-20 h-20 flex items-center justify-center rounded-full text-white text-sm transition-colors ${
            isMuted ? 'bg-red-500' : 'bg-gray-600 bg-opacity-50 hover:bg-opacity-70'
          }`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={onEndCall}
          className="w-24 h-24 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white font-bold"
        >
          End
        </button>
      </div>
    </div>
  );
};

export default AudioCall;