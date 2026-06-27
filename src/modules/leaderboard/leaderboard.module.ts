import { Module } from '@nestjs/common';

import { GameModule } from '@/modules/game/game.module';
import { GuestModule } from '@/modules/guest/guest.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { LeaderboardService } from '@/modules/leaderboard/leaderboard.service';
import { LeaderboardController } from '@/modules/leaderboard/leaderboard.controller';
import { LeaderboardCacheService } from '@/modules/leaderboard/leaderboard-cache.service';
import { LeaderboardMaintenanceService } from '@/modules/leaderboard/leaderboard-maintenance.service';

@Module({
  controllers: [LeaderboardController],
  imports: [GuestModule, RedisModule, GameModule],
  providers: [LeaderboardService, LeaderboardCacheService, LeaderboardMaintenanceService],
})
export class LeaderboardModule {}
