import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    query: { code, limit: rawLimit, cursor: rawCursor },
    method,
  } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Invalid trip code' });
  }

  const limit = Math.min(Math.max(Number(rawLimit ?? 50), 1), 200);
  const cursor = typeof rawCursor === 'string' ? rawCursor : undefined;

  const where: Record<string, any> = {
    trip: { shareCode: code },
  };

  if (cursor) {
    const date = new Date(cursor);
    if (!Number.isNaN(date.getTime())) {
      where.createdAt = { gt: date };
    }
  }

  const points = await prisma.locationPoint.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: limit + 1,
    select: { lat: true, lng: true, createdAt: true },
  });

  const hasMore = points.length > limit;
  const resultPoints = hasMore ? points.slice(0, limit) : points;
  const nextCursor = hasMore ? resultPoints[resultPoints.length - 1]?.createdAt.toISOString() : null;

  return res.status(200).json({ points: resultPoints, nextCursor });
}
