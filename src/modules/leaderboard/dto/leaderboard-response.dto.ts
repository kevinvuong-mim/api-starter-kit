export class LeaderboardEntryDto {
  guestId!: string;
  name!: string | null;
  score!: number;
  rank!: number;
}

export class LeaderboardResponseDto {
  top!: LeaderboardEntryDto[];
  myRank!: number | null;
}
