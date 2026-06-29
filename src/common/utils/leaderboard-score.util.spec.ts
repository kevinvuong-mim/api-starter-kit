import { decodeLeaderboardScore, encodeLeaderboardScore } from '@/common/utils';

describe('leaderboard-score.util', () => {
  it('encodes and decodes bestScore', () => {
    const encoded = encodeLeaderboardScore(5000, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(decodeLeaderboardScore(encoded)).toBe(5000);
  });

  it('ranks lower guestId higher on ties', () => {
    const score = 1000;
    const lower = encodeLeaderboardScore(score, '00000000-0000-4000-8000-000000000001');
    const higher = encodeLeaderboardScore(score, 'ffffffff-ffff-4fff-8fff-ffffffffffff');
    expect(lower).toBeGreaterThan(higher);
  });
});
