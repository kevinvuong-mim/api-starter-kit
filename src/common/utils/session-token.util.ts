import { createHash, randomUUID } from 'node:crypto';

export function generateSessionToken(): string {
  return randomUUID();
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getSessionTokenExpiry(ttlDays: number): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);
  return expiresAt;
}
