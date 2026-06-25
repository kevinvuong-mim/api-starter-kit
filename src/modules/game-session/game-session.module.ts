import { Module } from '@nestjs/common';

import { GuestModule } from '@/modules/guest/guest.module';
import { SeasonModule } from '@/modules/season/season.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { AntiCheatModule } from '@/modules/anti-cheat/anti-cheat.module';
import { GameSessionController } from '@/modules/game-session/game-session.controller';
import { GameSessionService } from '@/modules/game-session/game-session.service';
import { GameSessionRepository } from '@/modules/game-session/game-session.repository';

@Module({
  imports: [GuestModule, AntiCheatModule, SeasonModule, RedisModule],
  controllers: [GameSessionController],
  providers: [GameSessionService, GameSessionRepository],
})
export class GameSessionModule {}
