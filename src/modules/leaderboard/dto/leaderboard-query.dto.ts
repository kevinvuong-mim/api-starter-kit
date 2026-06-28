import { Type } from 'class-transformer';
import { Max, Min, IsInt, IsString, Matches, IsOptional } from 'class-validator';

const GUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class LeaderboardQueryDto {
  @IsString()
  gameId!: string;

  @IsOptional()
  @IsString()
  @Matches(GUEST_ID_PATTERN, { message: 'guestId must be a UUID' })
  guestId?: string;

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
