import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppService } from '@/app.service';
import { AppController } from '@/app.controller';
import { GameModule } from '@/modules/game/game.module';
import { GuestModule } from '@/modules/guest/guest.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { LeaderboardModule } from '@/modules/leaderboard/leaderboard.module';
import { RedisThrottlerStorageService } from '@/modules/redis/redis-throttler-storage.service';

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
    GameModule,
    GuestModule,
    RedisModule,
    PrismaModule,
    LeaderboardModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisThrottlerStorageService],
      useFactory: (storage: RedisThrottlerStorageService) => ({
        storage,
        throttlers: [
          {
            ttl: 60000,
            limit: 100,
          },
        ],
      }),
    }),
  ],
})
export class AppModule {}
