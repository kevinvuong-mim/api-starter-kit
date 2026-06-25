import { Type } from 'class-transformer';
import {
  Min,
  IsInt,
  IsArray,
  IsString,
  IsUUID,
  IsObject,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class GameResultDto {
  @IsInt()
  @Min(0)
  score!: number;

  @IsInt()
  @Min(0)
  duration!: number;

  @IsString()
  replayHash!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SyncGameResultsDto {
  @IsString()
  gameId!: string;

  @IsUUID()
  guestId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GameResultDto)
  results!: GameResultDto[];
}
