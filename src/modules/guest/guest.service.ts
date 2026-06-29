import { GuestPlayer, Prisma } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';

import { InitGuestDto } from '@/modules/guest/dto/init-guest.dto';
import { GuestRepository } from '@/modules/guest/guest.repository';
import { InitGuestResponseDto } from '@/modules/guest/dto/init-guest-response.dto';
import { GuestProfileResponseDto } from '@/modules/guest/dto/guest-profile-response.dto';

@Injectable()
export class GuestService {
  constructor(private readonly guestRepository: GuestRepository) {}

  async initializeGuest(dto: InitGuestDto): Promise<InitGuestResponseDto> {
    const { installId } = dto;

    if (installId) {
      const existing = await this.guestRepository.findByInstallId(installId);
      if (existing) {
        return {
          guestId: existing.id,
          relinked: true,
        };
      }
    }

    try {
      const credentials = await this.guestRepository.create(installId);
      return {
        guestId: credentials.guestId,
        relinked: false,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Lost a concurrent init race for the same installId. Re-read the winning row so
        // a double-submit from the same device still resolves to one guest.
        if (installId) {
          const existing = await this.guestRepository.findByInstallId(installId);
          if (existing) {
            return {
              guestId: existing.id,
              relinked: true,
            };
          }
        }
      }

      throw error;
    }
  }

  getProfile(guest: GuestPlayer): GuestProfileResponseDto {
    return {
      guestId: guest.id,
      name: guest.name,
    };
  }

  async getGuestById(guestId: string): Promise<GuestPlayer | undefined> {
    return (await this.guestRepository.findById(guestId)) ?? undefined;
  }

  async getGuestByIdOrThrow(guestId: string): Promise<GuestPlayer> {
    const guest = await this.getGuestById(guestId);
    if (!guest) {
      throw new NotFoundException(`Guest "${guestId}" not found`);
    }

    return guest;
  }

  async updateName(guest: GuestPlayer, name: string): Promise<GuestProfileResponseDto> {
    const updated = await this.guestRepository.updateName(guest.id, name);
    return {
      guestId: updated.id,
      name: updated.name,
    };
  }
}
