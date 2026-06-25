import { GuestPlayer } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';

import { GuestRepository } from '@/modules/guest/guest.repository';
import { GuestProfileResponseDto } from '@/modules/guest/dto/guest-profile-response.dto';

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

  async updateName(guestId: string, name: string): Promise<GuestProfileResponseDto> {
    await this.getGuestOrThrow(guestId);
    const guest = await this.guestRepository.updateName(guestId, name);
    return { guestId: guest.id, name: guest.name };
  }
}
