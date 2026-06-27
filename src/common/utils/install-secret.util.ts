import { randomUUID, timingSafeEqual } from 'node:crypto';

import { hashSessionToken } from '@/common/utils/session-token.util';

export function generateInstallSecret(): string {
  return randomUUID();
}

export function hashInstallSecret(secret: string): string {
  return hashSessionToken(secret);
}

export function verifyInstallSecret(secret: string, storedHash: string): boolean {
  const computed = hashInstallSecret(secret);
  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(storedHash, 'utf8');

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
