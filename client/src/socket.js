import { io } from 'socket.io-client';

const SOCKET_URL = 'https://daring-courtesy-production-7412.up.railway.app';

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
});

export default socket;