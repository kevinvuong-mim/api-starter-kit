import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { REDIS_CLIENT } from '@/modules/redis/redis.constants';

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  postgres: 'up' | 'down';
  redis: 'up' | 'down';
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);

    return {
      postgres,
      redis,
      timestamp: new Date().toISOString(),
      status: postgres === 'up' && redis === 'up' ? 'ok' : 'degraded',
    };
  }

  private async checkPostgres(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<'up' | 'down'> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
