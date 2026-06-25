import { Module } from '@nestjs/common';

import { GuestModule } from '@/modules/guest/guest.module';
import { ReplayModule } from '@/modules/replay/replay.module';
import { SeasonModule } from '@/modules/season/season.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { GameRegistryModule } from '@/modules/game/game-registry.module';
import { GameController } from '@/modules/game/game.controller';
import { GameService } from '@/modules/game/game.service';
import { GameRepository } from '@/modules/game/game.repository';

@Module({
  imports: [GuestModule, ReplayModule, SeasonModule, RedisModule, GameRegistryModule],
  controllers: [GameController],
  providers: [GameService, GameRepository],
})
export class GameModule {}
