import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppService } from '@/app.service';
import { AppController } from '@/app.controller';
import { GameModule } from '@/modules/game/game.module';
import { GuestModule } from '@/modules/guest/guest.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { ReplayModule } from '@/modules/replay/replay.module';
import { LeaderboardModule } from '@/modules/leaderboard/leaderboard.module';

@Module({
  controllers: [AppController],
  imports: [
    GameModule,
    GuestModule,
    RedisModule,
    PrismaModule,
    ReplayModule,
    LeaderboardModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
