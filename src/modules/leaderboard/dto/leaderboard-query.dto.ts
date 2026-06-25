import { Type } from 'class-transformer';
import { Max, Min, IsInt, IsString } from 'class-validator';

export class LeaderboardQueryDto {
  @IsString()
  gameId!: string;

  @Min(1)
  @IsInt()
  @Type(() => Number)
  page: number = 1;

  @Min(1)
  @IsInt()
  @Max(100)
  @Type(() => Number)
  limit: number = 100;
}
