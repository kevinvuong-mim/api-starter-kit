import { Get, Query, Controller, UseGuards } from '@nestjs/common';

import { CurrentGuest } from '@/common/auth/current-guest.decorator';
import { LeaderboardService } from '@/modules/leaderboard/leaderboard.service';
import { OptionalGuestAuthGuard } from '@/common/auth/optional-guest-auth.guard';
import { LeaderboardQueryDto } from '@/modules/leaderboard/dto/leaderboard-query.dto';
import { LeaderboardResponseDto } from '@/modules/leaderboard/dto/leaderboard-response.dto';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('global')
  @UseGuards(OptionalGuestAuthGuard)
  getGlobal(
    @Query() query: LeaderboardQueryDto,
    @CurrentGuest() guest?: { id: string },
  ): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getGlobalLeaderboard(query, guest?.id);
  }
}
