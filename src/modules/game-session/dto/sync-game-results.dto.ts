import { Type } from 'class-transformer';
import {
  Min,
  IsInt,
  IsArray,
  IsString,
  IsUUID,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { GameMoveDto } from '@/modules/game-session/dto/game-move.dto';

export class GameResultDto {
  @ApiProperty({ example: 1000 })
  @IsInt()
  @Min(0)
  score!: number;

  @ApiProperty({ example: 180 })
  @IsInt()
  @Min(1)
  duration!: number;

  @ApiProperty({ example: 12345 })
  @IsInt()
  @Min(0)
  seed!: number;

  @ApiProperty({ example: [{ action: 'tap', x: 1, y: 2 }] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GameMoveDto)
  moves!: GameMoveDto[];

  @ApiProperty({ example: 'a3f2c1b9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0' })
  @IsString()
  replayHash!: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  clientVersion?: string;

  @ApiPropertyOptional({ example: '2026-06-20T10:00:00.000Z' })
  @IsOptional()
  @IsString()
  playedAt?: string;
}

export class SyncGameResultsDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  guestId!: string;

  @ApiProperty({ type: [GameResultDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GameResultDto)
  results!: GameResultDto[];
}
