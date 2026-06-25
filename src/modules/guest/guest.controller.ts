import { Body, Post, Patch, Controller, UseGuards } from '@nestjs/common';

import { GuestService } from '@/modules/guest/guest.service';
import { GuestAuthGuard } from '@/common/auth/guest-auth.guard';
import { CurrentGuest } from '@/common/auth/current-guest.decorator';
import { UpdateGuestNameDto } from '@/modules/guest/dto/update-guest-name.dto';
import { InitGuestResponseDto } from '@/modules/guest/dto/init-guest-response.dto';
import { GuestProfileResponseDto } from '@/modules/guest/dto/guest-profile-response.dto';

@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Post('init')
  async initGuest(): Promise<InitGuestResponseDto> {
    return this.guestService.initializeGuest();
  }

  @Patch('name')
  @UseGuards(GuestAuthGuard)
  async updateName(
    @Body() dto: UpdateGuestNameDto,
    @CurrentGuest() guest: { id: string },
  ): Promise<GuestProfileResponseDto> {
    return this.guestService.updateName(guest.id, dto.name);
  }
}
