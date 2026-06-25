import { Module } from '@nestjs/common';

import { GuestController } from '@/modules/guest/guest.controller';
import { GuestService } from '@/modules/guest/guest.service';
import { GuestRepository } from '@/modules/guest/guest.repository';

@Module({
  controllers: [GuestController],
  exports: [GuestService, GuestRepository],
  providers: [GuestService, GuestRepository],
})
export class GuestModule {}
