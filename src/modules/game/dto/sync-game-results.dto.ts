import {
  Min,
  IsInt,
  IsArray,
  IsString,
  IsOptional,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { IsValidMetadata } from '@/common/validators/is-valid-metadata.validator';

export class GameResultDto {
  @Min(0)
  @IsInt()
  score!: number;

  @Min(0)
  @IsInt()
  duration!: number;

  @IsString()
  replayHash!: string;

  @IsOptional()
  @IsValidMetadata()
  metadata?: Record<string, string | number | boolean | null>;
}

export class SyncGameResultsDto {
  @IsString()
  gameId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Type(() => GameResultDto)
  @ValidateNested({ each: true })
  results!: GameResultDto[];
}
