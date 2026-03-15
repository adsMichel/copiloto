import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketServer } from 'socket.io';
import { prisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const socketServer = (res.socket as any)?.server;
  if (!socketServer) {
    return res.status(500).end();
  }

  if (!socketServer.io) {
    const io = new SocketServer(socketServer, {
      path: '/api/socket',
      cors: {
        origin: '*',
      },
    });

    io.on('connection', (socket) => {
      const authToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : null;
      const auth = authToken ? verifyAuthToken(authToken) : null;

      socket.on('join', (payload: unknown) => {
        if (typeof payload !== 'object' || payload === null) return;
        const tripCode = (payload as any).tripCode;
        if (typeof tripCode !== 'string' || tripCode.trim().length === 0) return;

        socket.join(tripCode);
      });

      socket.on('location:update', async (payload: unknown) => {
        if (
          typeof payload !== 'object' ||
          payload === null ||
          typeof (payload as any).tripCode !== 'string' ||
          typeof (payload as any).lat !== 'number' ||
          typeof (payload as any).lng !== 'number'
        ) {
          return;
        }

        const { tripCode, lat, lng } = payload as { tripCode: string; lat: number; lng: number };

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
        } catch (err) {
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
