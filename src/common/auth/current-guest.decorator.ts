import { GuestPlayer } from '@prisma/client';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentGuest = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GuestPlayer | undefined => {
    const request = ctx.switchToHttp().getRequest<{ guest?: GuestPlayer }>();
    return request.guest;
  },
);
