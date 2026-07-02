import { GuestService } from '@/modules/guest/guest.service';
import { GameId } from '@/common/constants';

describe('GuestService', () => {
  const guestRepository = {
    create: jest.fn().mockResolvedValue({
      id: 'guest-uuid',
      gameId: GameId.FRULOOP,
    }),
    updateName: jest.fn().mockResolvedValue({
      id: 'guest-uuid',
      gameId: GameId.FRULOOP,
      name: 'PlayerOne',
    }),
  };

  const service = new GuestService(guestRepository as never);

  it('creates a new guest with secret token', async () => {
    const result = await service.initializeGuest({ gameId: GameId.FRULOOP });

    expect(result.guestId).toBe('guest-uuid');
    expect(result.gameId).toBe(GameId.FRULOOP);
    expect(result.secretToken).toEqual(expect.any(String));
    expect(guestRepository.create).toHaveBeenCalled();
  });

  it('updates guest name', async () => {
    const result = await service.updateName('guest-uuid', GameId.FRULOOP, 'PlayerOne');

    expect(result).toEqual({
      guestId: 'guest-uuid',
      gameId: GameId.FRULOOP,
      name: 'PlayerOne',
    });
  });
});
