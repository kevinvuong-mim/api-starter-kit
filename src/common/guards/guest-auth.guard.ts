import { Request } from 'express';
import { GuestPlayer } from '@prisma/client';
import { Injectable, CanActivate, BadRequestException, ExecutionContext } from '@nestjs/common';

import { GuestService } from '@/modules/guest/guest.service';

type GuestRequest = Request & { body?: { guestId?: unknown }; guest?: GuestPlayer };

@Injectable()
export class GuestAuthGuard implements CanActivate {
  constructor(private readonly guestService: GuestService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    const guestId = this.extractGuestId(request);

    if (!guestId) {
      throw new BadRequestException('guestId required');
    }

    request.guest = await this.guestService.getGuestByIdOrThrow(guestId);
    return true;
  }

  private extractGuestId(request: GuestRequest): string | undefined {
    const bodyGuestId = request.body?.guestId;
    if (typeof bodyGuestId === 'string' && bodyGuestId.length > 0) {
      return bodyGuestId;
    }

    const queryGuestId = request.query.guestId;
    if (typeof queryGuestId === 'string' && queryGuestId.length > 0) {
      return queryGuestId;
    }

    const headerGuestId = request.headers['x-guest-id'];
    return typeof headerGuestId === 'string' && headerGuestId.length > 0
      ? headerGuestId
      : undefined;
  }
}
