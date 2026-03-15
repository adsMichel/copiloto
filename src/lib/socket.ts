import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (socket) {
    socket.auth = { token: authToken };
    if (socket.connected) {
      socket.disconnect();
      socket.connect();
    }
  }
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/api/socket',
      autoConnect: false,
      // Allow polling fallback in case WebSocket is blocked or fails to upgrade.
      transports: ['polling', 'websocket'],
      auth: {
        token: authToken,
      },
    });
  }
  return socket;
}

export function ensureConnected() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }

  if (typeof window !== 'undefined') {
    // Expose socket for debugging and global listeners in client code.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).socket = s;
  }

  return s;
}

export function joinTripRoom(tripCode: string) {
  const s = ensureConnected();
  s.emit('join', { tripCode });
}

export function sendLocationUpdate(tripCode: string, lat: number, lng: number) {
  const s = ensureConnected();
  s.emit('location:update', { tripCode, lat, lng });
}
