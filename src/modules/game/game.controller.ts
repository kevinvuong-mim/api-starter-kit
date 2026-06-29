import { Throttle } from '@nestjs/throttler';
import { Post, Body, Param, Controller, UseGuards } from '@nestjs/common';

import { GameService } from '@/modules/game/services';
import { GuestAuthGuard } from '@/common/guards/guest-auth.guard';
import { GuestRateLimitGuard } from '@/common/guards/guest-rate-limit.guard';
import { SyncGameResultsDto } from '@/modules/game/dto/sync-game-results.dto';

@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post(':gameId/results')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(GuestAuthGuard, GuestRateLimitGuard)
  syncResults(@Param('gameId') gameId: string, @Body() dto: SyncGameResultsDto) {
    return this.gameService.syncResults(gameId, dto.guestId, dto.results);
  }
}
