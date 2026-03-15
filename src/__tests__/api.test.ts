import { createTrip, getTrip } from '@/lib/api';

describe('API helpers', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('calls /api/trips to create a trip', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ shareCode: 'abc-123', token: 'token-xyz' }));

    const result = await createTrip({ email: 'test@example.com' });

    expect(fetchMock).toHaveBeenCalledWith('/api/trips', expect.objectContaining({
      method: 'POST',
    }));
    expect(result.shareCode).toBe('abc-123');
    expect(result.token).toBe('token-xyz');
  });

  it('throws when createTrip fails', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: 'bad' }), { status: 400 });

    await expect(createTrip({ email: 'test@example.com' })).rejects.toThrow('bad');
  });

  it('calls /api/trips/:code to fetch trip details', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ id: '1', shareCode: 'abc', isActive: true, startedAt: new Date().toISOString() }));

    const result = await getTrip('abc');
    expect(fetchMock).toHaveBeenCalledWith('/api/trips/abc');
    expect(result.shareCode).toBe('abc');
  });
});
