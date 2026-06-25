import { Body, Patch, Post, Controller } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { GuestService } from '@/modules/guest/guest.service';
import { InitGuestResponseDto } from '@/modules/guest/dto/init-guest-response.dto';
import { UpdateGuestNameDto } from '@/modules/guest/dto/update-guest-name.dto';
import { GuestProfileResponseDto } from '@/modules/guest/dto/guest-profile-response.dto';

@ApiTags('guest')
@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Post('init')
  @ApiOperation({ summary: 'Initialize a new guest player' })
  @ApiResponse({ status: 201, type: InitGuestResponseDto })
  async initGuest(): Promise<InitGuestResponseDto> {
    return this.guestService.initializeGuest();
  }

  @Patch('name')
  @ApiOperation({ summary: 'Update a guest player display name' })
  @ApiResponse({ status: 200, type: GuestProfileResponseDto })
  async updateName(@Body() dto: UpdateGuestNameDto): Promise<GuestProfileResponseDto> {
    return this.guestService.updateName(dto.guestId, dto.name);
  }
}
