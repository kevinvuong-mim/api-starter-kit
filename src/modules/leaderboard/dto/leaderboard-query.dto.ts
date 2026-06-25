import { Type } from 'class-transformer';
import { Max, Min, IsInt, IsUUID, IsString, IsOptional } from 'class-validator';

export class LeaderboardQueryDto {
  @IsString()
  gameId!: string;

  @Min(1)
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @Min(1)
  @IsInt()
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 100;

  @IsUUID()
  @IsOptional()
  guestId?: string;
}
