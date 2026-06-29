import { Throttle } from '@nestjs/throttler';
import type { GuestPlayer } from '@prisma/client';
import { Body, Post, Patch, Controller, UseGuards } from '@nestjs/common';

import { GuestService } from '@/modules/guest/guest.service';
import { GuestAuthGuard } from '@/common/guards/guest-auth.guard';
import { InitGuestDto } from '@/modules/guest/dto/init-guest.dto';
import { CurrentGuest } from '@/common/decorators/current-guest.decorator';
import { UpdateGuestNameDto } from '@/modules/guest/dto/update-guest-name.dto';

@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Post('init')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  initGuest(@Body() dto: InitGuestDto) {
    return this.guestService.initializeGuest(dto);
  }

  @Patch('name')
  @UseGuards(GuestAuthGuard)
  async updateName(@Body() dto: UpdateGuestNameDto, @CurrentGuest() guest: GuestPlayer) {
    return this.guestService.updateName(guest, dto.name);
  }
}
