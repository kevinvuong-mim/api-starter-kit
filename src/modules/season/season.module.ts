import { Module } from '@nestjs/common';

import { GameRegistryModule } from '@/modules/game/game-registry.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { SeasonRepository } from '@/modules/season/season.repository';
import { SeasonService } from '@/modules/season/season.service';

@Module({
  imports: [GameRegistryModule, RedisModule],
  exports: [SeasonService, SeasonRepository],
  providers: [SeasonService, SeasonRepository],
})
export class SeasonModule {}
