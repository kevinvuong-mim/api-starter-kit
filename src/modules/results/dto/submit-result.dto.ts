import {
  Min,
  IsInt,
  IsArray,
  IsString,
  IsISO8601,
  IsOptional,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { IsValidMetadata } from '@/common/validators';

export class SubmitResultDto {
  @IsString()
  clientResultId!: string;

  @Min(0)
  @IsInt()
  score!: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  playedAt?: string;

  @IsOptional()
  @IsValidMetadata()
  metadata?: Record<string, string | number | boolean | null>;

  @IsString()
  signature!: string;
}

export class SubmitResultBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SubmitResultDto)
  items!: SubmitResultDto[];
}
