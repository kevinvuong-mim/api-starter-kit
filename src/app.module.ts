import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppService } from '@/app.service';
import { AppController } from '@/app.controller';
import { AppConfigModule } from '@/config/config.module';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { GuestModule } from '@/modules/guest/guest.module';
import { AntiCheatModule } from '@/modules/anti-cheat/anti-cheat.module';
import { SeasonModule } from '@/modules/season/season.module';
import { GameSessionModule } from '@/modules/game-session/game-session.module';
import { LeaderboardModule } from '@/modules/leaderboard/leaderboard.module';
import { HttpExceptionFilter } from '@/common/filters';

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
    AppConfigModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    GuestModule,
    AntiCheatModule,
    SeasonModule,
    GameSessionModule,
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
