import { Request } from 'express';
import { GuestPlayer } from '@prisma/client';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

import { GuestService } from '@/modules/guest/guest.service';
import { extractBearerToken } from '@/common/auth/extract-bearer-token';

type GuestRequest = Request & { guest?: GuestPlayer };

@Injectable()
export class OptionalGuestAuthGuard implements CanActivate {
  constructor(private readonly guestService: GuestService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    const token = extractBearerToken(request);

    if (token) {
      request.guest = await this.guestService.getGuestBySessionToken(token);
    }

    return true;
  }
}
