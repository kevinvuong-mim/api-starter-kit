import { Get, Query, Controller } from '@nestjs/common';

import { LeaderboardService } from '@/modules/leaderboard/leaderboard.service';
import { LeaderboardQueryDto } from '@/modules/leaderboard/dto/leaderboard-query.dto';
import { LeaderboardResponseDto } from '@/modules/leaderboard/dto/leaderboard-response.dto';

@Controller('leaderboards')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getLeaderboard(@Query() query: LeaderboardQueryDto): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getLeaderboard(query, query.guestId);
  }
}
