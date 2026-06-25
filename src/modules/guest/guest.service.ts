import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GuestPlayer } from '@prisma/client';

import { GuestRepository } from '@/modules/guest/guest.repository';

@Injectable()
export class GuestService {
  constructor(private readonly guestRepository: GuestRepository) {}

  async initializeGuest(): Promise<{ guestId: string }> {
    const guest = await this.guestRepository.create();
    return { guestId: guest.id };
  }

  async getGuestOrThrow(guestId: string): Promise<GuestPlayer> {
    const guest = await this.guestRepository.findById(guestId);
    if (!guest) {
      throw new NotFoundException('Guest player not found');
    }

    return guest;
  }

  async assertCanSync(guestId: string): Promise<GuestPlayer> {
    const guest = await this.getGuestOrThrow(guestId);

    if (guest.status === 'BLOCKED') {
      throw new ForbiddenException('Guest player is blocked from syncing');
    }

    return guest;
  }

  async touchGuest(guestId: string): Promise<void> {
    await this.guestRepository.updateLastActive(guestId);
  }

  async penalizeGuest(guestId: string, penalty: number): Promise<GuestPlayer> {
    return this.guestRepository.applyTrustPenalty(guestId, penalty);
  }
}
