import { io, Socket } from 'socket.io-client';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';
let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    console.log(`Connecting Socket.io client to ${WS_BASE}...`);
    socket = io(WS_BASE, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket.io client connected with ID:', socket?.id);
    });

    socket.on('connect_error', (error) => {
      console.warn('Socket connection error:', error.message);
    });
  }
  return socket;
};

export default getSocket;
