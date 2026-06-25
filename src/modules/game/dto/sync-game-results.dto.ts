import {
  Min,
  IsInt,
  IsUUID,
  IsArray,
  IsString,
  IsObject,
  IsOptional,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GameResultDto {
  @Min(0)
  @IsInt()
  score!: number;

  @Min(0)
  @IsInt()
  duration!: number;

  @IsString()
  replayHash!: string;

  @IsObject()
  @IsOptional()
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
  @Type(() => GameResultDto)
  @ValidateNested({ each: true })
  results!: GameResultDto[];
}
