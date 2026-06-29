import { Get, Query, Controller } from '@nestjs/common';

import { LeaderboardService } from '@/modules/leaderboard/services';
import { LeaderboardQueryDto } from '@/modules/leaderboard/dto/leaderboard-query.dto';

@Controller('leaderboards')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.getLeaderboard(query, query.guestId);
  }
}
