import { Test, TestingModule } from '@nestjs/testing';

import { GuestService } from '@/modules/guest/guest.service';
import { GuestRepository } from '@/modules/guest/guest.repository';

describe('GuestService', () => {
  let service: GuestService;

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    updateLastActive: jest.fn(),
    applyTrustPenalty: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestService,
        { provide: GuestRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get(GuestService);
    jest.clearAllMocks();
  });

  it('initializes a guest player', async () => {
    mockRepository.create.mockResolvedValue({ id: 'guest-123' });

    const result = await service.initializeGuest();
    expect(result).toEqual({ guestId: 'guest-123' });
    expect(mockRepository.create).toHaveBeenCalled();
  });
});
