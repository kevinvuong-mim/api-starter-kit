import { Body, Post, Controller } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { GameService } from '@/modules/game/game.service';
import { SyncGameResultsDto } from '@/modules/game/dto/sync-game-results.dto';
import { SyncGameResultsResponseDto } from '@/modules/game/dto/sync-game-results-response.dto';

@ApiTags('game')
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Sync offline game results in batch' })
  @ApiResponse({ status: 201, type: SyncGameResultsResponseDto })
  async syncResults(@Body() dto: SyncGameResultsDto): Promise<SyncGameResultsResponseDto> {
    return this.gameService.syncResults(dto.gameId, dto.guestId, dto.results);
  }
}
