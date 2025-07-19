import io from 'socket.io-client';

// --- HARDCODED CHANGE: Direct Railway URL yahan daal dein ---
const SOCKET_URL = "https://daring-courtesy-production-7412.up.railway.app";

const socket = io(SOCKET_URL, {
  // Ye options connection ko behtar bana sakte hain
  reconnectionAttempts: 5,
  transports: ['websocket'], // Force WebSocket transport
});

export default socket;