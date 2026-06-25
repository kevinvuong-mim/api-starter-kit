import { Module } from '@nestjs/common';

import { GuestModule } from '@/modules/guest/guest.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { GameRegistryModule } from '@/modules/game/game-registry.module';
import { LeaderboardService } from '@/modules/leaderboard/leaderboard.service';
import { LeaderboardController } from '@/modules/leaderboard/leaderboard.controller';
import { LeaderboardMaintenanceService } from '@/modules/leaderboard/leaderboard-maintenance.service';

@Module({
  controllers: [LeaderboardController],
  imports: [GuestModule, RedisModule, GameRegistryModule],
  providers: [LeaderboardService, LeaderboardMaintenanceService],
})
export class LeaderboardModule {}
