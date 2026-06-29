import { Throttle } from '@nestjs/throttler';
import { Post, Body, Param, Controller, UseGuards } from '@nestjs/common';

import { GameService } from '@/modules/game/game.service';
import { GuestAuthGuard } from '@/common/guards/guest-auth.guard';
import { GuestRateLimitGuard } from '@/common/guards/guest-rate-limit.guard';
import { SyncGameResultsDto } from '@/modules/game/dto/sync-game-results.dto';
import { SyncGameResultsResponseDto } from '@/modules/game/dto/sync-game-results-response.dto';

@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post(':gameId/results')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(GuestAuthGuard, GuestRateLimitGuard)
  async syncResults(
    @Param('gameId') gameId: string,
    @Body() dto: SyncGameResultsDto,
  ): Promise<SyncGameResultsResponseDto> {
    return this.gameService.syncResults(gameId, dto.guestId, dto.results);
  }
}
