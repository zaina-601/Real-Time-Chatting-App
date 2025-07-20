import { io } from 'socket.io-client';

const SOCKET_URL = 'https://daring-courtesy-production-7412.up.railway.app';

const socket = io(SOCKET_URL, {
  transports: ['polling', 'websocket'], // Try polling first
  timeout: 20000,
  forceNew: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  maxReconnectionAttempts: 10,
  upgrade: true,
  rememberUpgrade: false,
  autoConnect: true
});

// Connection event logging
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('🔴 Socket connection error:', error);
});

socket.on('reconnect', (attemptNumber) => {
  console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('🔄 Socket reconnection attempt:', attemptNumber);
});

socket.on('reconnect_error', (error) => {
  console.error('🔴 Socket reconnection error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('🔴 Socket reconnection failed');
});

socket.on('error', (error) => {
  console.error('🔴 Socket error:', error);
});

socket.on('connectionConfirmed', (data) => {
  console.log('✅ Connection confirmed:', data);
});

// Transport change events
socket.io.on('upgrade', () => {
  console.log('✅ Upgraded to transport:', socket.io.engine.transport.name);
});

socket.io.on('upgradeError', (error) => {
  console.error('🔴 Upgrade error:', error);
});

export default socket;