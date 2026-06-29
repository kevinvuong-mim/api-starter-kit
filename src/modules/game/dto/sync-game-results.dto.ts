import {
  Min,
  IsInt,
  Matches,
  IsArray,
  IsString,
  IsISO8601,
  IsOptional,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { IsValidMetadata } from '@/common/validators/is-valid-metadata.validator';

const GUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class GameResultDto {
  @Min(0)
  @IsInt()
  score!: number;

  @IsString()
  replayHash!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  playedAt?: string;

  @IsOptional()
  @IsValidMetadata()
  metadata?: Record<string, string | number | boolean | null>;
}

export class SyncGameResultsDto {
  @IsString()
  @Matches(GUEST_ID_PATTERN, { message: 'guestId must be a UUID' })
  guestId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Type(() => GameResultDto)
  @ValidateNested({ each: true })
  results!: GameResultDto[];
}
