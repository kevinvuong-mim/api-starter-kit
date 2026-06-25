import { Module } from '@nestjs/common';

import { GameRegistryModule } from '@/modules/game/game-registry.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { LeaderboardController } from '@/modules/leaderboard/leaderboard.controller';
import { LeaderboardMaintenanceService } from '@/modules/leaderboard/leaderboard-maintenance.service';
import { LeaderboardService } from '@/modules/leaderboard/leaderboard.service';

@Module({
  imports: [RedisModule, GameRegistryModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, LeaderboardMaintenanceService],
})
export class LeaderboardModule {}
