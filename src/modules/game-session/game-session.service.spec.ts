import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { GameSessionService } from '@/modules/game-session/game-session.service';
import { GuestService } from '@/modules/guest/guest.service';
import { AntiCheatService } from '@/modules/anti-cheat/anti-cheat.service';
import { SeasonService } from '@/modules/season/season.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { GameSessionRepository } from '@/modules/game-session/game-session.repository';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { GAME_CONFIG_KEY } from '@/config/game.config';

describe('GameSessionService', () => {
  let service: GameSessionService;

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

  const mockGuestService = {
    assertCanSync: jest.fn(),
    getGuestOrThrow: jest.fn(),
    touchGuest: jest.fn(),
    penalizeGuest: jest.fn(),
  };

  const mockAntiCheatService = {
    validate: jest.fn(),
    computeReplayHash: jest.fn(),
  };

  const mockSeasonService = {
    getActiveWeeklySeason: jest.fn(),
  };

  const mockRedisRankingService = {
    updateScore: jest.fn(),
    getGlobalKey: jest.fn().mockReturnValue('lb:global'),
    getWeeklyKey: jest.fn().mockReturnValue('lb:weekly:season-1'),
  };

  const mockRepository = {
    findByReplayHash: jest.fn(),
    createResult: jest.fn(),
    getBestScoreForGuest: jest.fn(),
  };

  const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    leaderboardGlobal: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    leaderboardWeekly: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameSessionService,
        { provide: GuestService, useValue: mockGuestService },
        { provide: AntiCheatService, useValue: mockAntiCheatService },
        { provide: SeasonService, useValue: mockSeasonService },
        { provide: RedisRankingService, useValue: mockRedisRankingService },
        { provide: GameSessionRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === GAME_CONFIG_KEY ? gameConfig : undefined),
          },
        },
      ],
    }).compile();

    service = module.get(GameSessionService);

    jest.clearAllMocks();

    mockGuestService.assertCanSync.mockResolvedValue({ id: 'guest-1', status: 'NORMAL' });
    mockGuestService.getGuestOrThrow.mockResolvedValue({ id: 'guest-1', status: 'NORMAL' });
    mockSeasonService.getActiveWeeklySeason.mockResolvedValue({ id: 'season-1' });
    mockRepository.getBestScoreForGuest.mockResolvedValue(1000);
    mockPrisma.leaderboardGlobal.findUnique.mockResolvedValue(null);
    mockPrisma.leaderboardWeekly.findUnique.mockResolvedValue(null);
  });

  it('accepts valid results and updates leaderboards', async () => {
    mockRepository.findByReplayHash.mockResolvedValue(null);
    mockAntiCheatService.validate.mockResolvedValue({ valid: true });

    const result = {
      score: 1000,
      duration: 60,
      seed: 1,
      moves: [],
      replayHash: 'hash-1',
    };

    const response = await service.syncResults('guest-1', [result]);

    expect(response.accepted).toBe(1);
    expect(response.rejected).toBe(0);
    expect(response.bestScore).toBe(1000);
    expect(mockRepository.createResult).toHaveBeenCalled();
    expect(mockRedisRankingService.updateScore).toHaveBeenCalled();
  });

  it('treats duplicate replay for same guest as accepted', async () => {
    mockRepository.findByReplayHash.mockResolvedValue({
      id: 'existing',
      guestId: 'guest-1',
    });

    const response = await service.syncResults('guest-1', [
      {
        score: 1000,
        duration: 60,
        seed: 1,
        moves: [],
        replayHash: 'hash-1',
      },
    ]);

    expect(response.accepted).toBe(1);
    expect(response.rejected).toBe(0);
    expect(mockRepository.createResult).not.toHaveBeenCalled();
  });
});
