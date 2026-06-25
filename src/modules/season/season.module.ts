import { Module } from '@nestjs/common';

import { SeasonService } from '@/modules/season/season.service';
import { SeasonRepository } from '@/modules/season/season.repository';
import { RedisModule } from '@/modules/redis/redis.module';

@Module({
  imports: [RedisModule],
  exports: [SeasonService, SeasonRepository],
  providers: [SeasonService, SeasonRepository],
})
export class SeasonModule {}
