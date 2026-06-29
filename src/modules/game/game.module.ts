import { Module } from '@nestjs/common';

import { GameService } from '@/modules/game/game.service';
import { GuestModule } from '@/modules/guest/guest.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { GameController } from '@/modules/game/game.controller';
import { GameRepository } from '@/modules/game/game.repository';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { GuestRateLimitGuard } from '@/common/guards/guest-rate-limit.guard';
import { GameResultsPartitionService } from '@/modules/game/game-results-partition.service';

@Module({
  controllers: [GameController],
  providers: [
    GameService,
    GameRepository,
    GameRegistryService,
    GuestRateLimitGuard,
    GameResultsPartitionService,
  ],
  imports: [GuestModule, RedisModule],
  exports: [GameRegistryService, GameRepository],
})
export class GameModule {}
