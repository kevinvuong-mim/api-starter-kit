import { Module } from '@nestjs/common';

import {
  LeaderboardService,
  LeaderboardCacheService,
  LeaderboardMaintenanceService,
} from '@/modules/leaderboard/services';
import { GameModule } from '@/modules/game/game.module';
import { GuestModule } from '@/modules/guest/guest.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { LeaderboardController } from '@/modules/leaderboard/leaderboard.controller';

@Module({
  controllers: [LeaderboardController],
  imports: [GuestModule, RedisModule, GameModule],
  providers: [LeaderboardService, LeaderboardCacheService, LeaderboardMaintenanceService],
})
export class LeaderboardModule {}
