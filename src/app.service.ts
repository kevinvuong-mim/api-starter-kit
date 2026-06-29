import Redis from 'ioredis';
import { Inject, Injectable } from '@nestjs/common';

import { REDIS_CLIENT } from '@/modules/redis/redis.constants';
import { PrismaService } from '@/modules/prisma/prisma.service';

export interface HealthCheckResult {
  timestamp: string;
  redis: 'up' | 'down';
  postgres: 'up' | 'down';
  status: 'ok' | 'degraded';
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async check(): Promise<HealthCheckResult> {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);

    return {
      redis,
      postgres,
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
