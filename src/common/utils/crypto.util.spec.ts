import {
  hashSecretToken,
  isValidSha256Hex,
  generateSecretToken,
  computeReplaySignature,
  verifyReplaySignature,
  dedupLockKey,
  timingSafeCompare,
} from './crypto.util';
import { buildReplayPayload } from './game.util';

describe('crypto.util', () => {
  const secret = 'a'.repeat(64);

  it('generates and hashes secret tokens', () => {
    const token = generateSecretToken();
    const hash = hashSecretToken(token);

    expect(token.length).toBeGreaterThan(0);
    expect(isValidSha256Hex(hash)).toBe(true);
  });

  it('validates sha256 hex format', () => {
    expect(isValidSha256Hex(secret)).toBe(true);
    expect(isValidSha256Hex('not-hex')).toBe(false);
  });

  it('computes and verifies replay signatures with hex compare', () => {
    const payload = buildReplayPayload({
      gameId: 'FRULOOP',
      guestId: 'guest-1',
      clientResultId: 'res-1',
      score: 100,
      playedAt: '2026-01-15T10:00:00.000Z',
    });

    const signature = computeReplaySignature(secret, payload);
    expect(verifyReplaySignature(secret, payload, signature)).toBe(true);
    expect(verifyReplaySignature(secret, payload, 'b'.repeat(64))).toBe(false);
  });

  it('derives stable dedup lock keys', () => {
    const first = dedupLockKey('FRULOOP', 'guest-1', 'res-1');
    const second = dedupLockKey('FRULOOP', 'guest-1', 'res-1');
    const different = dedupLockKey('FRULOOP', 'guest-1', 'res-2');

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it('compares strings in constant time', () => {
    expect(timingSafeCompare('abc', 'abc')).toBe(true);
    expect(timingSafeCompare('abc', 'abd')).toBe(false);
    expect(timingSafeCompare('abc', 'abcd')).toBe(false);
  });

  it('rejects invalid hex signatures safely', () => {
    const payload = buildReplayPayload({
      gameId: 'FRULOOP',
      guestId: 'guest-1',
      clientResultId: 'res-1',
      score: 100,
    });

    expect(verifyReplaySignature(secret, payload, 'not-hex')).toBe(false);
  });
});
