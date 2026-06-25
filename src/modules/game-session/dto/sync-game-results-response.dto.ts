import { ApiProperty } from '@nestjs/swagger';

export class SyncGameResultsResponseDto {
  @ApiProperty({ example: 1 })
  accepted!: number;

  @ApiProperty({ example: 0 })
  rejected!: number;

  @ApiProperty({ example: 1200 })
  bestScore!: number;
}
