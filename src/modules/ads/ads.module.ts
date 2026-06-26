import { Module } from '@nestjs/common';

import { AdsService } from '@/modules/ads/ads.service';
import { GuestModule } from '@/modules/guest/guest.module';
import { AdsRepository } from '@/modules/ads/ads.repository';
import { AdsMaintenanceService } from '@/modules/ads/ads-maintenance.service';
import { AdsController, AdsAdminController } from '@/modules/ads/ads.controller';

@Module({
  imports: [GuestModule],
  exports: [AdsService, AdsRepository],
  controllers: [AdsController, AdsAdminController],
  providers: [AdsService, AdsRepository, AdsMaintenanceService],
})
export class AdsModule {}
