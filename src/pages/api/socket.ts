import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth';

type SocketServerWithIO = HTTPServer & { io?: SocketIOServer };
type NextApiResponseWithSocket = NextApiResponse & { socket: NetSocket & { server: SocketServerWithIO } };

type JoinPayload = { tripCode: string };
type LocationUpdatePayload = { tripCode: string; lat: number; lng: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJoinPayload(payload: unknown): payload is JoinPayload {
  if (!isRecord(payload)) return false;
  const tripCode = payload.tripCode;
  return typeof tripCode === 'string' && tripCode.trim().length > 0;
}

function isLocationUpdatePayload(payload: unknown): payload is LocationUpdatePayload {
  if (!isRecord(payload)) return false;
  return (
    typeof payload.tripCode === 'string' &&
    typeof payload.lat === 'number' &&
    typeof payload.lng === 'number'
  );
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const socketServer = (res as NextApiResponseWithSocket).socket?.server;
  if (!socketServer) {
    return res.status(500).end();
  }

  if (!socketServer.io) {
    const io = new SocketIOServer(socketServer, {
      path: '/api/socket',
      cors: {
        origin: '*',
      },
    });

    io.on('connection', (socket) => {
      const authToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : null;
      const auth = authToken ? verifyAuthToken(authToken) : null;

      socket.on('join', (payload: unknown) => {
        if (!isJoinPayload(payload)) return;
        socket.join(payload.tripCode);
      });

      socket.on('location:update', async (payload: unknown) => {
        if (!isLocationUpdatePayload(payload)) return;
        const { tripCode, lat, lng } = payload;

        // Only the driver (token owner) can send location updates for their trip.
        if (!auth || auth.role !== 'driver' || auth.tripCode !== tripCode) {
          return;
        }

        socket.to(tripCode).emit('location:update', { lat, lng, timestamp: Date.now() });

        // Persist latest location and keep a history of points.
        // It’s okay if the trip no longer exists (e.g., expired), so we swallow errors.
        try {
          await prisma.trip.update({
            where: { shareCode: tripCode },
            data: {
              lastLatitude: lat,
              lastLongitude: lng,
              points: {
                create: {
                  lat,
                  lng,
                },
              },
            },
          });
        } catch {
          // ignore, we still want to emit updates to connected clients
        }
      });

      socket.on('disconnect', () => {
        // no-op for now
      });
    });

    socketServer.io = io;
  }

  res.status(200).end();
}
