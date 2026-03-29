import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { signAuthToken } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, name } = req.body as { email?: string; name?: string };

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: { name: name ?? undefined },
      create: { email: normalizedEmail, name },
    });

    const trip = await prisma.trip.create({
      data: {
        riderId: user.id,
      },
    });

    const token = signAuthToken({ sub: user.id, tripCode: trip.shareCode, role: 'driver' });

    return res.status(201).json({ shareCode: trip.shareCode, token });
  } catch (err) {
    console.error('[api/trips] unhandled error', err);

    const includeDetail =
      process.env.NODE_ENV === 'development' || process.env.DEBUG_API_ERRORS === '1';

    const detail = includeDetail
      ? err instanceof Error
        ? err.message
        : String(err)
      : undefined;

    return res.status(500).json({ error: 'Internal server error', ...(detail ? { detail } : {}) });
  }
}
