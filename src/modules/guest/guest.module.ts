import { Module } from '@nestjs/common';

import { GuestService } from '@/modules/guest/guest.service';
import { GuestAuthGuard } from '@/common/auth/guest-auth.guard';
import { GuestController } from '@/modules/guest/guest.controller';
import { GuestRepository } from '@/modules/guest/guest.repository';
import { OptionalGuestAuthGuard } from '@/common/auth/optional-guest-auth.guard';

@Module({
  controllers: [GuestController],
  exports: [GuestService, GuestRepository, GuestAuthGuard, OptionalGuestAuthGuard],
  providers: [GuestService, GuestRepository, GuestAuthGuard, OptionalGuestAuthGuard],
})
export class GuestModule {}
