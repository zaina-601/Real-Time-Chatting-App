import io from 'socket.io-client';

// --- HARDCODED URL: Direct Railway URL yahan daal dein ---
const SOCKET_URL = "https://daring-courtesy-production-7412.up.railway.app";

const socket = io(SOCKET_URL, {
  reconnectionAttempts: 5,
  transports: ['websocket'], // Force WebSocket transport
});

export default socket;