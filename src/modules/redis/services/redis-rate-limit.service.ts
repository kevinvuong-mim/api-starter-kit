import Redis from 'ioredis';
import { Inject, Injectable } from '@nestjs/common';

import { REDIS_CLIENT } from '@/modules/redis/redis.constants';

@Injectable()
export class RedisRateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Sliding window counter. Returns true if the request is allowed.
   */
  async consume(key: string, limit: number, windowSeconds: number) {
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    return count <= limit;
  }
}
