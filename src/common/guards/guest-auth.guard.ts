import { Request } from 'express';
import { GuestPlayer } from '@prisma/client';
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { GuestService } from '@/modules/guest/guest.service';
import { extractBearerToken } from '@/common/utils/extract-bearer-token';

type GuestRequest = Request & { guest?: GuestPlayer };

@Injectable()
export class GuestAuthGuard implements CanActivate {
  constructor(private readonly guestService: GuestService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Session token required');
    }

    request.guest = await this.guestService.getGuestBySessionTokenOrThrow(token);
    return true;
  }
}
