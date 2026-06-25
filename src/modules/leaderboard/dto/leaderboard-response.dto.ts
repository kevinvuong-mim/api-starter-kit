export class LeaderboardEntryDto {
  rank!: number;
  score!: number;
  guestId!: string;
  name!: string | null;
}

export class LeaderboardResponseDto {
  myRank!: number | null;
  top!: LeaderboardEntryDto[];
}
