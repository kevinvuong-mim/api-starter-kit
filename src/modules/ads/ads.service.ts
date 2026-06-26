import {
  Logger,
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

import { AdsRepository } from '@/modules/ads/ads.repository';
import { ClaimRewardDto } from '@/modules/ads/dto/claim-reward.dto';
import { StartRewardDto } from '@/modules/ads/dto/start-reward.dto';
import { UpdateAdsConfigDto } from '@/modules/ads/dto/update-ads-config.dto';
import { AD_EVENT_TYPES, DEFAULT_ADS_CONFIG } from '@/modules/ads/ads.constants';
import { AdsConfigResponseDto } from '@/modules/ads/dto/ads-config-response.dto';
import { AdsMetricsResponseDto } from '@/modules/ads/dto/ads-metrics-response.dto';
import { ClaimRewardResponseDto } from '@/modules/ads/dto/claim-reward-response.dto';
import { StartRewardResponseDto } from '@/modules/ads/dto/start-reward-response.dto';
import type { AdFormat, AdsRuntimeConfig, ProviderVerifyPayload } from '@/modules/ads/ads.types';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly adsRepository: AdsRepository,
    private readonly configService: ConfigService,
  ) {}

  async getConfig(): Promise<AdsConfigResponseDto> {
    const config = await this.resolveConfig();
    return {
      cooldowns: config.cooldowns,
      placements: config.placements,
      bannerEnabled: config.bannerEnabled,
      rewardEnabled: config.rewardEnabled,
      appOpenEnabled: config.appOpenEnabled,
      interstitialEnabled: config.interstitialEnabled,
    };
  }

  async startReward(guestId: string, dto: StartRewardDto): Promise<StartRewardResponseDto> {
    const config = await this.resolveConfig();

    if (!config.rewardEnabled) {
      throw new ForbiddenException('Rewarded ads are disabled');
    }

    const format = config.placements[dto.placement];
    if (format !== 'rewarded') {
      throw new BadRequestException(`Placement ${dto.placement} is not rewarded`);
    }

    const reward = config.rewards[dto.placement];
    if (!reward) {
      throw new BadRequestException(`No reward configured for placement ${dto.placement}`);
    }

    const cooldownSeconds = config.cooldowns.rewarded ?? 30;
    const cooldownSince = new Date(Date.now() - cooldownSeconds * 1000);
    const recent = await this.adsRepository.findRecentRewardSession(
      guestId,
      dto.placement,
      cooldownSince,
    );
    if (recent) {
      throw new ConflictException('Reward cooldown active');
    }

    const ttlSeconds = Number(this.configService.get('ADS_REWARD_SESSION_TTL_SECONDS') ?? 300);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const session = await this.adsRepository.createRewardSession({
      guestId,
      expiresAt,
      rewardType: reward.type,
      placement: dto.placement,
      rewardAmount: reward.amount,
    });

    await this.adsRepository.logEvent({
      guestId,
      placement: dto.placement,
      event: 'reward_session_started',
      metadata: { rewardSessionId: session.id },
    });

    return {
      rewardSessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async claimReward(guestId: string, dto: ClaimRewardDto): Promise<ClaimRewardResponseDto> {
    const session = await this.adsRepository.findRewardSessionById(dto.rewardSessionId);
    if (!session) {
      throw new NotFoundException('Reward session not found');
    }

    if (session.guestId !== guestId) {
      throw new ForbiddenException('Reward session does not belong to guest');
    }

    if (session.status === 'CLAIMED') {
      throw new ConflictException('Reward already claimed');
    }

    if (session.expiresAt < new Date()) {
      throw new BadRequestException('Reward session expired');
    }

    const verified = this.verifyProviderReward(dto.provider, dto.providerPayload ?? {});
    if (!verified) {
      await this.adsRepository.logEvent({
        guestId,
        provider: dto.provider,
        placement: session.placement,
        event: 'reward_verification_failed',
        metadata: dto.providerPayload as Prisma.InputJsonValue,
      });
      throw new BadRequestException('Provider reward verification failed');
    }

    const idempotencyKey = this.buildIdempotencyKey(
      dto.rewardSessionId,
      dto.provider,
      dto.providerPayload ?? {},
    );

    const claimed = await this.adsRepository.claimRewardSession(
      dto.rewardSessionId,
      dto.provider,
      idempotencyKey,
    );

    if (!claimed) {
      throw new ConflictException('Reward claim rejected');
    }

    await this.adsRepository.logEvent({
      guestId,
      provider: dto.provider,
      placement: session.placement,
      event: AD_EVENT_TYPES.REWARD_CLAIMED,
      metadata: {
        rewardSessionId: session.id,
        rewardType: session.rewardType,
        rewardAmount: session.rewardAmount,
      },
    });

    return {
      success: true,
      placement: session.placement,
      reward: {
        amount: session.rewardAmount ?? 0,
        type: session.rewardType ?? 'coins',
      },
    };
  }

  async logClientEvent(
    guestId: string | undefined,
    event: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.adsRepository.logEvent({
      guestId,
      event,
      provider: typeof metadata?.provider === 'string' ? metadata.provider : undefined,
      placement: typeof metadata?.placement === 'string' ? metadata.placement : undefined,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    });
  }

  async getMetrics(): Promise<AdsMetricsResponseDto> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const counts = await this.adsRepository.countEventsByTypeSince(
      [
        AD_EVENT_TYPES.REWARD_CLAIMED,
        AD_EVENT_TYPES.BANNER_LOADED,
        AD_EVENT_TYPES.IMPRESSION,
        AD_EVENT_TYPES.LOADED,
        AD_EVENT_TYPES.FAILED,
      ],
      since,
    );

    const dau = await this.adsRepository.countDistinctGuestsSince(since);
    const loaded = counts[AD_EVENT_TYPES.LOADED] ?? 0;
    const failed = counts[AD_EVENT_TYPES.FAILED] ?? 0;
    const fillRate = loaded + failed > 0 ? loaded / (loaded + failed) : 0;
    const impressions = counts[AD_EVENT_TYPES.IMPRESSION] ?? 0;
    const rewardClaims = counts[AD_EVENT_TYPES.REWARD_CLAIMED] ?? 0;
    const bannerImpressions = counts[AD_EVENT_TYPES.BANNER_LOADED] ?? 0;
    const interstitialImpressions = Math.max(0, impressions - bannerImpressions);

    const estimatedEcpm = 2.5;
    const revenue = (impressions / 1000) * estimatedEcpm;
    const arpdau = dau > 0 ? revenue / dau : 0;
    const adsPerSession = dau > 0 ? impressions / dau : 0;

    return {
      dau,
      rewardClaims,
      estimatedEcpm,
      bannerImpressions,
      interstitialImpressions,
      arpdau: Number(arpdau.toFixed(4)),
      fillRate: Number(fillRate.toFixed(4)),
      adsPerSession: Number(adsPerSession.toFixed(2)),
    };
  }

  async updateConfig(dto: UpdateAdsConfigDto): Promise<AdsConfigResponseDto> {
    const current = await this.resolveConfig();
    const next: AdsRuntimeConfig = {
      ...current,
      ...dto,
      placements: {
        ...current.placements,
      } as AdsRuntimeConfig['placements'],
      ...this.normalizePlacements(dto.placements),
      rewards: { ...current.rewards, ...(dto.rewards ?? {}) },
      cooldowns: { ...current.cooldowns, ...(dto.cooldowns ?? {}) },
      bannerPlacements: dto.bannerPlacements ?? current.bannerPlacements,
    };

    await this.adsRepository.upsertConfig(next);
    return this.getConfig();
  }

  async resolveConfig(): Promise<AdsRuntimeConfig> {
    const stored = await this.adsRepository.getConfig();
    const base: AdsRuntimeConfig = { ...DEFAULT_ADS_CONFIG };

    if (!stored?.config || typeof stored.config !== 'object') {
      return base;
    }

    const override = stored.config as Partial<AdsRuntimeConfig>;
    return {
      ...base,
      ...override,
      rewards: { ...base.rewards, ...(override.rewards ?? {}) },
      cooldowns: { ...base.cooldowns, ...(override.cooldowns ?? {}) },
      placements: { ...base.placements, ...(override.placements ?? {}) },
      bannerPlacements: override.bannerPlacements ?? base.bannerPlacements,
    };
  }

  verifyAdminKey(apiKey: string | undefined): void {
    const expected = this.configService.get<string>('ADS_ADMIN_API_KEY');
    if (!expected) {
      throw new UnauthorizedException('Admin API not configured');
    }
    if (!apiKey || apiKey !== expected) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }

  private verifyProviderReward(provider: string, payload: ProviderVerifyPayload): boolean {
    switch (provider) {
      case 'mock':
        return payload.shown === true && payload.rewarded === true;
      case 'admob':
        return (
          payload.rewarded === true &&
          typeof payload.transactionId === 'string' &&
          payload.transactionId.length >= 8
        );
      default:
        this.logger.warn(`Unknown ads provider for verification: ${provider}`);
        return false;
    }
  }

  private buildIdempotencyKey(
    rewardSessionId: string,
    provider: string,
    payload: ProviderVerifyPayload,
  ): string {
    const raw = JSON.stringify({
      provider,
      rewardSessionId,
      transactionId: payload.transactionId ?? null,
    });
    return createHash('sha256').update(raw).digest('hex');
  }

  private normalizePlacements(
    placements?: Record<string, string>,
  ): Partial<Record<string, AdFormat>> {
    if (!placements) return {};
    return Object.fromEntries(
      Object.entries(placements).map(([key, value]) => [key, value as AdFormat]),
    );
  }
}
