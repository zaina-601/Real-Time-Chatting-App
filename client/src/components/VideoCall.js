import React, { useEffect, useState } from 'react';

const VideoCall = ({ stream, remoteStream, myVideo, theirVideo, onEndCall }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Attach the local user's stream to the 'myVideo' element
  useEffect(() => {
    if (myVideo.current && stream) {
      myVideo.current.srcObject = stream;
    }
  }, [stream, myVideo]);

  // Attach the remote user's stream to the 'theirVideo' element
  useEffect(() => {
    if (theirVideo.current && remoteStream) {
      theirVideo.current.srcObject = remoteStream;
    }
  }, [remoteStream, theirVideo]);

  const handleToggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };

  const handleToggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsCameraOff(!track.enabled);
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50">
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        {/* Their Video (background) */}
        <video
          ref={theirVideo}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* My Video (Picture-in-Picture) */}
        <video
          ref={myVideo}
          autoPlay
          playsInline
          muted
          className="absolute w-48 h-36 bottom-24 right-5 border-2 border-white rounded-lg shadow-lg"
        />
      </div>

      {/* Controls */}
      <div className="absolute bottom-5 flex items-center gap-4">
        <button
          onClick={handleToggleMute}
          className={`w-16 h-16 flex items-center justify-center rounded-full text-white text-xs ${
            isMuted ? 'bg-red-500' : 'bg-gray-600 bg-opacity-50'
          }`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={onEndCall}
          className="w-20 h-20 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white"
        >
          End Call
        </button>
        <button
          onClick={handleToggleCamera}
          className={`w-16 h-16 flex items-center justify-center rounded-full text-white text-xs ${
            isCameraOff ? 'bg-red-500' : 'bg-gray-600 bg-opacity-50'
          }`}
        >
          {isCameraOff ? 'Cam On' : 'Cam Off'}
        </button>
      </div>
    </div>
  );
};

export default VideoCall;