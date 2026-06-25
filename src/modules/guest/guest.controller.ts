import { Post, Controller } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { GuestService } from '@/modules/guest/guest.service';
import { InitGuestResponseDto } from '@/modules/guest/dto/init-guest-response.dto';

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
}
