import { io } from 'socket.io-client';

const SOCKET_URL = 'https://daring-courtesy-production-7412.up.railway.app';

const socket = io(SOCKET_URL, {
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  autoConnect: true
});

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error.message);
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('Socket reconnection attempt:', attemptNumber);
});

socket.on('reconnect_failed', () => {
  console.error('Socket reconnection failed after max attempts');
});

socket.on('connectionConfirmed', (data) => {
    console.log('Connection confirmed by server:', data);
    if (!data.dbConnected) {
        console.error("Server has indicated a database connection problem.");
    }
});

socket.io.on('upgrade', () => {
  console.log('Upgraded to transport:', socket.io.engine.transport.name);
});

export default socket;