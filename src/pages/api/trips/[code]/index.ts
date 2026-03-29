import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getTripLastLocation } from '@/lib/locationCache';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    query: { code },
    method,
  } = req;

  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Invalid trip code' });
  }

  if (method === 'GET') {
    const trip = await prisma.trip.findUnique({
      where: { shareCode: code },
      select: {
        id: true,
        shareCode: true,
        isActive: true,
        startedAt: true,
        lastLatitude: true,
        lastLongitude: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const cached = getTripLastLocation(code);
    if (cached) {
      // Prefer the freshest known point for initial page load (even if we persist history less frequently).
      // This is best-effort and per-process (single instance).
      return res.status(200).json({
        ...trip,
        lastLatitude: cached.lat,
        lastLongitude: cached.lng,
      });
    }

    return res.status(200).json(trip);
  }

  res.setHeader('Allow', 'GET');
  return res.status(405).end();
}
