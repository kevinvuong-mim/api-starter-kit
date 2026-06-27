import { Cron } from '@nestjs/schedule';
import { Logger, Injectable } from '@nestjs/common';

import { LeaderboardCacheService } from '@/modules/leaderboard/leaderboard-cache.service';

@Injectable()
export class LeaderboardMaintenanceService {
  private readonly logger = new Logger(LeaderboardMaintenanceService.name);

  constructor(private readonly leaderboardCacheService: LeaderboardCacheService) {}

  @Cron('0 3 * * *')
  async rebuildRedisLeaderboards(): Promise<void> {
    this.logger.log('Scheduled Redis leaderboard rebuild');
    await this.leaderboardCacheService.warmAll();
    this.logger.log('Scheduled Redis leaderboard rebuild complete');
  }
}
