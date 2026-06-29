/** Encode bestScore + guestId tie-break (lower guestId ranks higher) into a single Redis ZSET score. */
const TIE_BREAKER_BASE = 4_294_967_296; // 2^32

export function decodeLeaderboardScore(encoded: number): number {
  return Math.floor(encoded / TIE_BREAKER_BASE);
}

export function encodeLeaderboardScore(bestScore: number, guestId: string): number {
  const hex = guestId.replace(/-/g, '').slice(0, 8);
  const guestNum = Number.parseInt(hex, 16);
  const tieBreaker = TIE_BREAKER_BASE - 1 - (guestNum % TIE_BREAKER_BASE);
  return bestScore * TIE_BREAKER_BASE + tieBreaker;
}
