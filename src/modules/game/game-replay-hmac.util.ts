import { createHmac, timingSafeEqual } from 'node:crypto';

export const RUN_SEED_METADATA_KEY = 'runSeed';

export function computeReplayHash(
  replaySecret: string,
  gameId: string,
  score: number,
  runSeed: string,
): string {
  const payload = `${gameId}|${score}|${runSeed}`;
  return createHmac('sha256', replaySecret).update(payload).digest('hex');
}

export function verifyReplayHash(
  replaySecret: string,
  gameId: string,
  score: number,
  runSeed: string,
  replayHash: string,
): boolean {
  const expected = computeReplayHash(replaySecret, gameId, score, runSeed);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(replayHash, 'utf8');

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
