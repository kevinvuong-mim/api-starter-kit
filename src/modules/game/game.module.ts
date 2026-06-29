import { Module } from '@nestjs/common';

import {
  GameService,
  GameRegistryService,
  GameResultsPartitionService,
} from '@/modules/game/services';
import { GuestModule } from '@/modules/guest/guest.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { GameController } from '@/modules/game/game.controller';
import { GameRepository } from '@/modules/game/game.repository';
import { GuestRateLimitGuard } from '@/common/guards/guest-rate-limit.guard';

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
