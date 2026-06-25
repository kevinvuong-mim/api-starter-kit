import { Body, Post, Controller } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { GameSessionService } from '@/modules/game-session/game-session.service';
import { SyncGameResultsDto } from '@/modules/game-session/dto/sync-game-results.dto';
import { SyncGameResultsResponseDto } from '@/modules/game-session/dto/sync-game-results-response.dto';

@ApiTags('game')
@Controller('game')
export class GameSessionController {
  constructor(private readonly gameSessionService: GameSessionService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Sync offline game results in batch' })
  @ApiResponse({ status: 201, type: SyncGameResultsResponseDto })
  async syncResults(@Body() dto: SyncGameResultsDto): Promise<SyncGameResultsResponseDto> {
    return this.gameSessionService.syncResults(dto.guestId, dto.results);
  }
}
