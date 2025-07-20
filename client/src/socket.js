import { io } from 'socket.io-client';

const SOCKET_URL = 'https://daring-courtesy-production-7412.up.railway.app';

// --- FINAL FIX: Saaf aur simple options ---
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'], // Pehle WebSocket try karega
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Zaroori event listeners
socket.on('connect', () => console.log('✅ Socket connected:', socket.id));
socket.on('disconnect', (reason) => console.log('❌ Socket disconnected:', reason));
socket.on('connect_error', (error) => console.error('🔴 Socket connection error:', error.message));

export default socket;