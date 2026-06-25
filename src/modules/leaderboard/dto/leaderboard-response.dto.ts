import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  guestId!: string;

  @ApiPropertyOptional({ example: 'PlayerOne', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 1500 })
  score!: number;

  @ApiProperty({ example: 1 })
  rank!: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  top!: LeaderboardEntryDto[];

  @ApiPropertyOptional({ example: 123, nullable: true })
  myRank!: number | null;
}
