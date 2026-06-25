import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { REDIS_CLIENT } from '@/modules/redis/redis.constants';
import { RedisRankingService, createRedisClient } from '@/modules/redis/redis-ranking.service';

@Module({
  imports: [ConfigModule],
  exports: [RedisRankingService],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: createRedisClient,
    },
    RedisRankingService,
  ],
})
export class RedisModule {}
