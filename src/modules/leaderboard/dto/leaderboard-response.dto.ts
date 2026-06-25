export class LeaderboardEntryDto {
  rank!: number;
  score!: number;
  guestId!: string;
  name!: string | null;
}

export class LeaderboardPaginationDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

export class LeaderboardResponseDto {
  myRank!: number | null;
  top!: LeaderboardEntryDto[];
  pagination!: LeaderboardPaginationDto;
}
