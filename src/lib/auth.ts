import jwt from 'jsonwebtoken';

export type AuthTokenPayload = {
  sub: string; // user id
  tripCode: string;
  role: 'driver';
};

const SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const EXPIRES_IN = '7d';

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}
