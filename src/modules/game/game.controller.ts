import { Post, Body, Controller } from '@nestjs/common';

import { GameService } from '@/modules/game/game.service';
import { SyncGameResultsDto } from '@/modules/game/dto/sync-game-results.dto';
import { SyncGameResultsResponseDto } from '@/modules/game/dto/sync-game-results-response.dto';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('sync')
  async syncResults(@Body() dto: SyncGameResultsDto): Promise<SyncGameResultsResponseDto> {
    return this.gameService.syncResults(dto.gameId, dto.guestId, dto.results);
  }
}
