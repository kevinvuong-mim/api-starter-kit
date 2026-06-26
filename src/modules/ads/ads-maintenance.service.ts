import { Logger, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AdsRepository } from '@/modules/ads/ads.repository';

@Injectable()
export class AdsMaintenanceService {
  private readonly logger = new Logger(AdsMaintenanceService.name);

  constructor(private readonly adsRepository: AdsRepository) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expirePendingSessions(): Promise<void> {
    const count = await this.adsRepository.expirePendingSessions();
    if (count > 0) {
      this.logger.log(`Expired ${count} pending ad reward sessions`);
    }
  }
}
