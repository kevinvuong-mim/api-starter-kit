import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { REDIS_CLIENT } from '@/modules/redis/redis.constants';
import { createRedisClient, RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { RedisRateLimitService } from '@/modules/redis/redis-rate-limit.service';
import { RedisThrottlerStorageService } from '@/modules/redis/redis-throttler-storage.service';

@Module({
  exports: [RedisRankingService, RedisRateLimitService, RedisThrottlerStorageService, REDIS_CLIENT],
  providers: [
    RedisRankingService,
    RedisRateLimitService,
    RedisThrottlerStorageService,
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: createRedisClient,
    },
  ],
})
export class RedisModule {}
