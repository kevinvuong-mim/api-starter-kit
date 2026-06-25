import { Post, Body, Controller, UseGuards } from '@nestjs/common';

import { GameService } from '@/modules/game/game.service';
import { GuestAuthGuard } from '@/common/auth/guest-auth.guard';
import { CurrentGuest } from '@/common/auth/current-guest.decorator';
import { SyncGameResultsDto } from '@/modules/game/dto/sync-game-results.dto';
import { SyncGameResultsResponseDto } from '@/modules/game/dto/sync-game-results-response.dto';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('sync')
  @UseGuards(GuestAuthGuard)
  async syncResults(
    @Body() dto: SyncGameResultsDto,
    @CurrentGuest() guest: { id: string },
  ): Promise<SyncGameResultsResponseDto> {
    return this.gameService.syncResults(dto.gameId, guest.id, dto.results);
  }
}
