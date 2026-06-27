import { Get, Query, Controller, UseGuards } from '@nestjs/common';

import { CurrentGuest } from '@/common/decorators/current-guest.decorator';
import { LeaderboardService } from '@/modules/leaderboard/leaderboard.service';
import { OptionalGuestAuthGuard } from '@/common/guards/optional-guest-auth.guard';
import { LeaderboardQueryDto } from '@/modules/leaderboard/dto/leaderboard-query.dto';
import { LeaderboardResponseDto } from '@/modules/leaderboard/dto/leaderboard-response.dto';

@Controller('leaderboards')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @UseGuards(OptionalGuestAuthGuard)
  getLeaderboard(
    @Query() query: LeaderboardQueryDto,
    @CurrentGuest() guest?: { id: string },
  ): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getLeaderboard(query, guest?.id);
  }
}
