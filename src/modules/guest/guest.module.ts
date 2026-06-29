import { Module } from '@nestjs/common';

import { GuestService } from '@/modules/guest/guest.service';
import { GuestAuthGuard } from '@/common/guards/guest-auth.guard';
import { GuestController } from '@/modules/guest/guest.controller';
import { GuestRepository } from '@/modules/guest/guest.repository';

@Module({
  controllers: [GuestController],
  exports: [GuestService, GuestRepository, GuestAuthGuard],
  providers: [GuestService, GuestRepository, GuestAuthGuard],
})
export class GuestModule {}
