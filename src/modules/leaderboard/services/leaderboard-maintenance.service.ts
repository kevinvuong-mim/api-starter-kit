import { Cron } from '@nestjs/schedule';
import { Logger, Injectable } from '@nestjs/common';

import { LeaderboardCacheService } from '@/modules/leaderboard/services';

@Injectable()
export class LeaderboardMaintenanceService {
  private readonly logger = new Logger(LeaderboardMaintenanceService.name);

  constructor(private readonly leaderboardCacheService: LeaderboardCacheService) {}

  @Cron('0 3 * * *')
  async rebuildRedisLeaderboards() {
    this.logger.log('Scheduled Redis leaderboard rebuild');
    await this.leaderboardCacheService.warmAll();
    this.logger.log('Scheduled Redis leaderboard rebuild complete');
  }
}
