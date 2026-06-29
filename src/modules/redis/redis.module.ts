import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  createRedisClient,
  RedisRankingService,
  RedisRateLimitService,
  RedisThrottlerStorageService,
} from './services';
import { REDIS_CLIENT } from '@/modules/redis/redis.constants';

@Module({
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
  exports: [REDIS_CLIENT, RedisRankingService, RedisRateLimitService, RedisThrottlerStorageService],
})
export class RedisModule {}
