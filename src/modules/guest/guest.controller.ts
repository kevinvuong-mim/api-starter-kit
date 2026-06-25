import { Body, Patch, Post, Controller } from '@nestjs/common';

import { GuestService } from '@/modules/guest/guest.service';
import { InitGuestResponseDto } from '@/modules/guest/dto/init-guest-response.dto';
import { UpdateGuestNameDto } from '@/modules/guest/dto/update-guest-name.dto';
import { GuestProfileResponseDto } from '@/modules/guest/dto/guest-profile-response.dto';

@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Post('init')
  async initGuest(): Promise<InitGuestResponseDto> {
    return this.guestService.initializeGuest();
  }

  @Patch('name')
  async updateName(@Body() dto: UpdateGuestNameDto): Promise<GuestProfileResponseDto> {
    return this.guestService.updateName(dto.guestId, dto.name);
  }
}
