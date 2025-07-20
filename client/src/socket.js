import { io } from 'socket.io-client';

// Hardcoded URL (bina aakhri slash ke)
const SOCKET_URL = 'https://daring-courtesy-production-7412.up.railway.app';

const socket = io(SOCKET_URL, {
  transports: ['websocket'], // Best for reliability
});

export default socket;