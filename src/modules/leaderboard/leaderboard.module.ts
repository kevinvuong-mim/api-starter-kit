import { Module } from '@nestjs/common';

import { GameRegistryModule } from '@/modules/game/game-registry.module';
import { SeasonModule } from '@/modules/season/season.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { LeaderboardController } from '@/modules/leaderboard/leaderboard.controller';
import { LeaderboardService } from '@/modules/leaderboard/leaderboard.service';

@Module({
  imports: [RedisModule, SeasonModule, GameRegistryModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
