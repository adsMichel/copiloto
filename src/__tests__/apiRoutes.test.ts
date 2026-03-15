import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/auth', () => ({
  signAuthToken: jest.fn(() => 'token-abc'),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      upsert: jest.fn(),
    },
    trip: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    locationPoint: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import createTripHandler from '@/pages/api/trips/index';
import getTripHandler from '@/pages/api/trips/[code]';
import historyHandler from '@/pages/api/trips/[code]/history';

const mockJson = jest.fn();
const mockStatus = jest.fn(() => ({ json: mockJson, end: jest.fn() }));
const mockSetHeader = jest.fn();

function createMockResponse() {
  return {
    status: mockStatus,
    json: mockJson,
    setHeader: mockSetHeader,
    end: jest.fn(),
  } as unknown as NextApiResponse;
}

describe('API route handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 405 when calling trips endpoint with wrong method', async () => {
    const req = { method: 'GET', body: {} } as Partial<NextApiRequest> as NextApiRequest;
    const res = createMockResponse();

    await createTripHandler(req, res);

    expect(mockStatus).toHaveBeenCalledWith(405);
    expect(mockSetHeader).toHaveBeenCalledWith('Allow', 'POST');
  });

  it('returns 400 when creating trip without email', async () => {
    const req = { method: 'POST', body: {} } as Partial<NextApiRequest> as NextApiRequest;
    const res = createMockResponse();

    await createTripHandler(req, res);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Email is required' });
  });

  it('returns 400 when trip code is not a string', async () => {
    const req = { method: 'GET', query: { code: ['invalid'] } } as Partial<NextApiRequest> as NextApiRequest;
    const res = createMockResponse();

    await getTripHandler(req, res);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid trip code' });
  });

  it('creates a trip when payload is valid', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.user.upsert as any).mockResolvedValue({ id: 'user-1' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.trip.create as any).mockResolvedValue({ shareCode: 'abc-123' });

    const req = { method: 'POST', body: { email: 'test@example.com' } } as Partial<NextApiRequest> as NextApiRequest;
    const res = createMockResponse();

    await createTripHandler(req, res);

    expect(mockStatus).toHaveBeenCalledWith(201);
    expect(mockJson).toHaveBeenCalledWith({ shareCode: 'abc-123', token: 'token-abc' });

    const { signAuthToken } = await import('@/lib/auth');
    expect(signAuthToken).toHaveBeenCalledWith({
      sub: 'user-1',
      tripCode: 'abc-123',
      role: 'driver',
    });
  });

  it('returns 404 when trip not found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.trip.findUnique as any).mockResolvedValue(null);

    const req = { method: 'GET', query: { code: 'abc' } } as Partial<NextApiRequest> as NextApiRequest;
    const res = createMockResponse();

    await getTripHandler(req, res);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Trip not found' });
  });

  it('returns history points with nextCursor when over limit', async () => {
    const now = new Date();
    const points = [
      { lat: 1, lng: 2, createdAt: new Date(now.getTime() - 2000) },
      { lat: 3, lng: 4, createdAt: new Date(now.getTime() - 1000) },
      { lat: 5, lng: 6, createdAt: now },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.locationPoint.findMany as any).mockResolvedValue(points);

    const req = {
      method: 'GET',
      query: { code: 'abc', limit: '2' },
    } as Partial<NextApiRequest> as NextApiRequest;
    const res = createMockResponse();

    await historyHandler(req, res);

    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        points: [
          { lat: 1, lng: 2, createdAt: points[0].createdAt },
          { lat: 3, lng: 4, createdAt: points[1].createdAt },
        ],
        nextCursor: points[1].createdAt.toISOString(),
      })
    );
  });

  it('passes cursor to prisma and returns filtered points', async () => {
    const cursor = new Date('2025-01-01T00:00:00.000Z').toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.locationPoint.findMany as any).mockResolvedValue([]);

    const req = {
      method: 'GET',
      query: { code: 'abc', cursor },
    } as Partial<NextApiRequest> as NextApiRequest;
    const res = createMockResponse();

    await historyHandler(req, res);

    expect(prisma.locationPoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gt: new Date(cursor) },
        }),
      })
    );

    expect(mockStatus).toHaveBeenCalledWith(200);
  });
});
