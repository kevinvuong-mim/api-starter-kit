import { Test, TestingModule } from '@nestjs/testing';

import { GameService } from '@/modules/game/game.service';
import { GuestService } from '@/modules/guest/guest.service';
import { ReplayService } from '@/modules/replay/replay.service';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { GameRepository } from '@/modules/game/game.repository';
import { PrismaService } from '@/modules/prisma/prisma.service';

describe('GameService', () => {
  let service: GameService;

  const mockGuestService = {
    getGuestOrThrow: jest.fn(),
  };

  const mockReplayService = {
    validate: jest.fn(),
  };

  const mockGameRegistryService = {
    assertActiveGame: jest.fn(),
  };

  const mockRedisRankingService = {
    updateScore: jest.fn(),
    getGlobalKey: jest.fn().mockReturnValue('lb:global:puzzle-quest'),
  };

  const mockRepository = {
    findByReplayHash: jest.fn(),
    createResult: jest.fn(),
    getBestScoreForGuest: jest.fn(),
  };

  const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    leaderboard: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: GuestService, useValue: mockGuestService },
        { provide: ReplayService, useValue: mockReplayService },
        { provide: GameRegistryService, useValue: mockGameRegistryService },
        { provide: RedisRankingService, useValue: mockRedisRankingService },
        { provide: GameRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(GameService);

    jest.clearAllMocks();

    mockGameRegistryService.assertActiveGame.mockResolvedValue({ id: 'puzzle-quest' });
    mockGuestService.getGuestOrThrow.mockResolvedValue({ id: 'guest-1' });
    mockRepository.getBestScoreForGuest.mockResolvedValue(1000);
    mockPrisma.leaderboard.findUnique.mockResolvedValue(null);
  });

  it('accepts valid results and updates leaderboards', async () => {
    mockRepository.findByReplayHash.mockResolvedValue(null);
    mockReplayService.validate.mockResolvedValue({ valid: true });

    const result = {
      score: 1000,
      duration: 60,
      replayHash: 'a'.repeat(64),
    };

    const response = await service.syncResults('puzzle-quest', 'guest-1', [result]);

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

    const response = await service.syncResults('puzzle-quest', 'guest-1', [
      {
        score: 1000,
        duration: 60,
        replayHash: 'a'.repeat(64),
      },
    ]);

    expect(response.accepted).toBe(1);
    expect(response.rejected).toBe(0);
    expect(mockRepository.createResult).not.toHaveBeenCalled();
  });
});
