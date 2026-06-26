import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppService } from '@/app.service';
import { AppController } from '@/app.controller';
import { AdsModule } from '@/modules/ads/ads.module';
import { GameModule } from '@/modules/game/game.module';
import { GuestModule } from '@/modules/guest/guest.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { ReplayModule } from '@/modules/replay/replay.module';
import { LeaderboardModule } from '@/modules/leaderboard/leaderboard.module';

@Module({
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  imports: [
    AdsModule,
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
    ConfigModule.forRoot({ isGlobal: true }),
  ],
})
export class AppModule {}
