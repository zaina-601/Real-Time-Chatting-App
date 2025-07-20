import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';

// Connect with socket
const socket = io(SOCKET_URL, {
  transports: ['websocket'], // optional, ensures best transport
  autoConnect: true,
});

// Optional: Debug all events
socket.onAny((event, ...args) => {
  console.log(`🔧 SOCKET EVENT: ${event}`, args);
});

export default socket;
