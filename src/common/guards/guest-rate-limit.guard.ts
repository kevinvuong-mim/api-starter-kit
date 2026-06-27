import { Request } from 'express';
import { GuestPlayer } from '@prisma/client';
import {
  Injectable,
  CanActivate,
  HttpException,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';

import { RedisRateLimitService } from '@/modules/redis/redis-rate-limit.service';

type GuestRequest = Request & { guest?: GuestPlayer };

/** Per-guest rate limit backed by Redis (token bucket via INCR + TTL). */
@Injectable()
export class GuestRateLimitGuard implements CanActivate {
  constructor(private readonly redisRateLimitService: RedisRateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    const guest = request.guest;

    if (!guest) {
      return true;
    }

    const key = `rl:guest:${guest.id}`;
    const allowed = await this.redisRateLimitService.consume(key, 30, 60);

    if (!allowed) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
