import { IsObject, IsString, MaxLength, IsOptional } from 'class-validator';

export class ClaimRewardDto {
  @IsString()
  @MaxLength(64)
  rewardSessionId!: string;

  @IsString()
  @MaxLength(32)
  provider!: string;

  @IsObject()
  @IsOptional()
  providerPayload?: Record<string, unknown>;
}
