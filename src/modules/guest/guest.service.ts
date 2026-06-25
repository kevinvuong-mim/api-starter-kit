import { Injectable, NotFoundException } from '@nestjs/common';
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
}
