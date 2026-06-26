export type AdFormat = 'banner' | 'app_open' | 'rewarded' | 'interstitial';

export interface AdPlacementReward {
  type: string;
  amount: number;
}

export interface AdCooldowns {
  app_open: number;
  rewarded: number;
  interstitial: number;
}

export interface AdPlacements {
  [placement: string]: AdFormat;
}

export interface AdRewardsMap {
  [placement: string]: AdPlacementReward;
}

export interface AdsRuntimeConfig {
  provider: string;
  rewards: AdRewardsMap;
  bannerEnabled: boolean;
  cooldowns: AdCooldowns;
  rewardEnabled: boolean;
  appOpenEnabled: boolean;
  placements: AdPlacements;
  bannerPlacements: string[];
  interstitialEnabled: boolean;
}

export interface AdMetrics {
  dau: number;
  arpdau: number;
  fillRate: number;
  rewardClaims: number;
  adsPerSession: number;
  estimatedEcpm: number;
  bannerImpressions: number;
  interstitialImpressions: number;
}

export interface ProviderVerifyPayload {
  shown?: boolean;
  rewarded?: boolean;
  transactionId?: string;
  [key: string]: unknown;
}
