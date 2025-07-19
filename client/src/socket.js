import io from 'socket.io-client';

const SOCKET_URL = "https://daring-courtesy-production-7412.up.railway.app";

const socket = io(SOCKET_URL, {
  withCredentials: false,
  transports: ['websocket'],
  reconnectionAttempts: 5,
  timeout: 20000
});

socket.on('connect', () => console.log("✅ Connected:", socket.id));
socket.on('connect_error', err => console.error("❌ Conn error:", err.message));
socket.on('disconnect', reason => console.log("⚠️ Disconnected:", reason));

export default socket;
