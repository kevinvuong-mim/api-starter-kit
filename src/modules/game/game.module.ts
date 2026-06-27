import { Module } from '@nestjs/common';

import { GameService } from '@/modules/game/game.service';
import { GuestModule } from '@/modules/guest/guest.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { GameController } from '@/modules/game/game.controller';
import { GameRepository } from '@/modules/game/game.repository';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { GuestRateLimitGuard } from '@/common/guards/guest-rate-limit.guard';
import { GameResultsPartitionService } from '@/modules/game/game-results-partition.service';
import { GameReplayKeyRetentionService } from '@/modules/game/game-replay-key-retention.service';

@Module({
  controllers: [GameController],
  providers: [
    GameService,
    GameRepository,
    GameRegistryService,
    GuestRateLimitGuard,
    GameResultsPartitionService,
    GameReplayKeyRetentionService,
  ],
  exports: [GameRegistryService, GameRepository],
  imports: [GuestModule, RedisModule],
})
export class GameModule {}
