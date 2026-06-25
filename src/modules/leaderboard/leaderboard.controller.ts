import { Get, Query, Controller } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { LeaderboardService } from '@/modules/leaderboard/leaderboard.service';
import { LeaderboardQueryDto } from '@/modules/leaderboard/dto/leaderboard-query.dto';
import { LeaderboardResponseDto } from '@/modules/leaderboard/dto/leaderboard-response.dto';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('global')
  @ApiOperation({ summary: 'Get global all-time leaderboard' })
  @ApiResponse({ status: 200, type: LeaderboardResponseDto })
  getGlobal(@Query() query: LeaderboardQueryDto): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getGlobalLeaderboard(query);
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Get active weekly season leaderboard' })
  @ApiResponse({ status: 200, type: LeaderboardResponseDto })
  getWeekly(@Query() query: LeaderboardQueryDto): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getWeeklyLeaderboard(query);
  }
}
