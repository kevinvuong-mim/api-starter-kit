import { IsObject, IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateAdsConfigDto {
  @IsBoolean()
  @IsOptional()
  rewardEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  interstitialEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  bannerEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  appOpenEnabled?: boolean;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsObject()
  @IsOptional()
  placements?: Record<string, string>;

  @IsObject()
  @IsOptional()
  cooldowns?: Record<string, number>;

  @IsObject()
  @IsOptional()
  rewards?: Record<string, { type: string; amount: number }>;

  @IsObject()
  @IsOptional()
  bannerPlacements?: string[];
}
