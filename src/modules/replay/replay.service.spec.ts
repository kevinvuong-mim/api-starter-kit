import { ReplayService } from '@/modules/replay/replay.service';
import { ReplayViolation } from '@/modules/replay/replay.types';
import { PrismaService } from '@/modules/prisma/prisma.service';

describe('ReplayService', () => {
  let service: ReplayService;

  const mockPrisma = {
    gameResult: {
      findUnique: jest.fn(),
    },
  };

  const validHash = 'a'.repeat(64);

  beforeEach(() => {
    mockPrisma.gameResult.findUnique.mockReset();
    service = new ReplayService(mockPrisma as unknown as PrismaService);
  });

  it('rejects missing replay hash', async () => {
    const result = await service.validate('game-1', 'guest-1', { replayHash: '' });

    expect(result.valid).toBe(false);
    expect(result.violation).toBe(ReplayViolation.MISSING_REPLAY_HASH);
  });

  it('rejects invalid replay hash format', async () => {
    const result = await service.validate('game-1', 'guest-1', { replayHash: 'not-a-hash' });

    expect(result.valid).toBe(false);
    expect(result.violation).toBe(ReplayViolation.INVALID_REPLAY_HASH_FORMAT);
  });

  it('accepts valid replay hash with no duplicate', async () => {
    mockPrisma.gameResult.findUnique.mockResolvedValue(null);

    const result = await service.validate('game-1', 'guest-1', { replayHash: validHash });

    expect(result.valid).toBe(true);
  });

  it('rejects duplicate replay from another guest', async () => {
    mockPrisma.gameResult.findUnique.mockResolvedValue({
      id: 'result-1',
      guestId: 'other-guest',
    });

    const result = await service.validate('game-1', 'guest-1', { replayHash: validHash });

    expect(result.valid).toBe(false);
    expect(result.violation).toBe(ReplayViolation.DUPLICATE_REPLAY);
  });
});
