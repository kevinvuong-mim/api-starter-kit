import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { REDIS_CLIENT } from '@/modules/redis/redis.constants';
import { createRedisClient, RedisRankingService } from '@/modules/redis/redis-ranking.service';

@Module({
  exports: [RedisRankingService],
  providers: [
    RedisRankingService,
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: createRedisClient,
    },
  ],
})
export class RedisModule {}
