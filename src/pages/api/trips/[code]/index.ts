import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

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

    return res.status(200).json(trip);
  }

  res.setHeader('Allow', 'GET');
  return res.status(405).end();
}
