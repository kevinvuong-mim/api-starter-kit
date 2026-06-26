import type { AdCooldowns, AdPlacements } from '@/modules/ads/ads.types';

export class AdsConfigResponseDto {
  bannerEnabled!: boolean;
  cooldowns!: AdCooldowns;
  rewardEnabled!: boolean;
  appOpenEnabled!: boolean;
  placements!: AdPlacements;
  interstitialEnabled!: boolean;
}
