import { Body, Get, Post, Query, Patch, Controller, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { GuestPlayer } from '@prisma/client';

import { GuestService } from '@/modules/guest/guest.service';
import { GuestAuthGuard } from '@/common/guards/guest-auth.guard';
import { CurrentGuest } from '@/common/decorators/current-guest.decorator';
import { InitGuestDto } from '@/modules/guest/dto/init-guest.dto';
import { GuestIdQueryDto } from '@/modules/guest/dto/guest-id-query.dto';
import { UpdateGuestNameDto } from '@/modules/guest/dto/update-guest-name.dto';
import { InitGuestResponseDto } from '@/modules/guest/dto/init-guest-response.dto';
import { GuestProfileResponseDto } from '@/modules/guest/dto/guest-profile-response.dto';

@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Post('init')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async initGuest(@Body() dto: InitGuestDto): Promise<InitGuestResponseDto> {
    return this.guestService.initializeGuest(dto);
  }

  @Get('me')
  @UseGuards(GuestAuthGuard)
  getProfile(
    @Query() _query: GuestIdQueryDto,
    @CurrentGuest() guest: GuestPlayer,
  ): GuestProfileResponseDto {
    return this.guestService.getProfile(guest);
  }

  @Patch('name')
  @UseGuards(GuestAuthGuard)
  async updateName(
    @Body() dto: UpdateGuestNameDto,
    @CurrentGuest() guest: GuestPlayer,
  ): Promise<GuestProfileResponseDto> {
    return this.guestService.updateName(guest, dto.name);
  }
}
