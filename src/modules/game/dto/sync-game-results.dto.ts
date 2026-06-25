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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GameResultDto {
  @ApiProperty({ example: 1000 })
  @IsInt()
  @Min(0)
  score!: number;

  @ApiProperty({ example: 180 })
  @IsInt()
  @Min(0)
  duration!: number;

  @ApiProperty({
    example: 'a3f2c1b9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
  })
  @IsString()
  replayHash!: string;

  @ApiPropertyOptional({ example: { level: 5, powerUps: ['shield'] } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SyncGameResultsDto {
  @ApiProperty({ example: 'puzzle-quest' })
  @IsString()
  gameId!: string;

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
