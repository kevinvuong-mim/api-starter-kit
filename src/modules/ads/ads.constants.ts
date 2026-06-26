import type { AdsRuntimeConfig } from '@/modules/ads/ads.types';

export const AD_EVENT_TYPES = {
  CLOSED: 'ads_closed',
  FAILED: 'ads_failed',
  LOADED: 'ads_loaded',
  OPENED: 'ads_opened',
  CLICKED: 'ads_clicked',
  CACHE_HIT: 'ad_cache_hit',
  CACHE_MISS: 'ad_cache_miss',
  IMPRESSION: 'ads_impression',
  BANNER_LOADED: 'banner_loaded',
  BANNER_HIDDEN: 'banner_hidden',
  ONLINE_RESTORE: 'online_restore',
  REWARD_EARNED: 'ads_reward_earned',
  REWARD_CLAIMED: 'ads_reward_claimed',
  OFFLINE_ATTEMPT: 'offline_ads_attempt',
  OFFLINE_REWARD_BLOCKED: 'offline_reward_blocked',
} as const;

export const DEFAULT_ADS_CONFIG: AdsRuntimeConfig = {
  cooldowns: {
    app_open: 0,
    rewarded: 30,
    interstitial: 90,
  },
  provider: 'mock',
  bannerEnabled: true,
  rewardEnabled: true,
  appOpenEnabled: false,
  interstitialEnabled: true,
  placements: {
    HOME: 'banner',
    SHOP: 'banner',
    LEADERBOARD: 'banner',
    APP_START: 'app_open',
    EXTRA_LIFE: 'rewarded',
    DOUBLE_COIN: 'rewarded',
    GAME_OVER: 'interstitial',
  },
  rewards: {
    DOUBLE_COIN: { type: 'coins', amount: 100 },
    EXTRA_LIFE: { type: 'extra_life', amount: 1 },
  },
  bannerPlacements: ['HOME', 'LEADERBOARD', 'SHOP', 'GAME_OVER'],
};
