import { Module } from '@nestjs/common';

import { GameService } from '@/modules/game/game.service';
import { GuestModule } from '@/modules/guest/guest.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { ReplayModule } from '@/modules/replay/replay.module';
import { GameController } from '@/modules/game/game.controller';
import { GameRepository } from '@/modules/game/game.repository';
import { GameRegistryModule } from '@/modules/game/game-registry.module';

@Module({
  controllers: [GameController],
  providers: [GameService, GameRepository],
  imports: [GuestModule, RedisModule, ReplayModule, GameRegistryModule],
})
export class GameModule {}
