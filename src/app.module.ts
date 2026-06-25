import { Module } from '@nestjs/common';

import { AppService } from '@/app.service';
import { AppController } from '@/app.controller';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { GuestModule } from '@/modules/guest/guest.module';
import { ReplayModule } from '@/modules/replay/replay.module';
import { GameModule } from '@/modules/game/game.module';
import { LeaderboardModule } from '@/modules/leaderboard/leaderboard.module';
import { HttpExceptionFilter } from '@/common/filters';

import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    GuestModule,
    ReplayModule,
    GameModule,
    LeaderboardModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
})
export class AppModule {}
