import { signAuthToken, verifyAuthToken } from '@/lib/auth';

describe('auth token helpers', () => {
  it('signs and verifies a token', () => {
    const payload = { sub: 'user-1', tripCode: 'abc', role: 'driver' } as const;
    const token = signAuthToken(payload);

    const verified = verifyAuthToken(token);

    expect(verified).not.toBeNull();
    expect(verified).toMatchObject(payload);
  });

  it('returns null for an invalid token', () => {
    expect(verifyAuthToken('not-a-token')).toBeNull();
  });
});
