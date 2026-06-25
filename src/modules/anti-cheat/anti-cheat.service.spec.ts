import { ConfigService } from '@nestjs/config';

import { AntiCheatService } from '@/modules/anti-cheat/anti-cheat.service';
import { AntiCheatViolation } from '@/modules/anti-cheat/anti-cheat.types';
import { GAME_CONFIG_KEY } from '@/config/game.config';
import { PrismaService } from '@/modules/prisma/prisma.service';

describe('AntiCheatService', () => {
  let service: AntiCheatService;

  const mockPrisma = {
    gameResult: {
      findUnique: jest.fn(),
    },
  };

  const gameConfig = {
    maxScore: 1_000_000,
    minDurationSeconds: 5,
    maxActionsPerSecond: 10,
    trustPenalty: 20,
    shadowThreshold: 60,
    blockedThreshold: 20,
    maxSeed: 2_147_483_647,
    leaderboardTopLimit: 100,
    nearbyRankRange: 2,
  };

  beforeEach(() => {
    mockPrisma.gameResult.findUnique.mockReset();

    service = new AntiCheatService(
      mockPrisma as unknown as PrismaService,
      {
        get: (key: string) => (key === GAME_CONFIG_KEY ? gameConfig : undefined),
      } as unknown as ConfigService,
    );
  });

  it('rejects impossible score', async () => {
    const result = await service.validate(
      {
        score: 2_000_000,
        duration: 60,
        seed: 1,
        moves: [],
        replayHash: 'invalid',
      },
      'guest-1',
    );

    expect(result.valid).toBe(false);
    expect(result.violation).toBe(AntiCheatViolation.IMPOSSIBLE_SCORE);
  });

  it('rejects short duration', async () => {
    const result = await service.validate(
      {
        score: 100,
        duration: 2,
        seed: 1,
        moves: [],
        replayHash: 'invalid',
      },
      'guest-1',
    );

    expect(result.valid).toBe(false);
    expect(result.violation).toBe(AntiCheatViolation.DURATION_TOO_SHORT);
  });

  it('validates replay hash', async () => {
    const input = {
      score: 500,
      duration: 30,
      seed: 42,
      moves: [{ action: 'tap' }],
      replayHash: '',
    };

    input.replayHash = service.computeReplayHash(input);
    mockPrisma.gameResult.findUnique.mockResolvedValue(null);

    const result = await service.validate(input, 'guest-1');
    expect(result.valid).toBe(true);
  });

  it('rejects duplicate replay from another guest', async () => {
    const input = {
      score: 500,
      duration: 30,
      seed: 42,
      moves: [],
      replayHash: '',
    };
    input.replayHash = service.computeReplayHash(input);

    mockPrisma.gameResult.findUnique.mockResolvedValue({
      id: 'result-1',
      guestId: 'other-guest',
    });

    const result = await service.validate(input, 'guest-1');
    expect(result.valid).toBe(false);
    expect(result.violation).toBe(AntiCheatViolation.DUPLICATE_REPLAY);
  });
});
