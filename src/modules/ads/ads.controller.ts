import { Get, Body, Post, Patch, Headers, UseGuards, Controller } from '@nestjs/common';

import { AdsService } from '@/modules/ads/ads.service';
import { GuestAuthGuard } from '@/common/guards/guest-auth.guard';
import { ClaimRewardDto } from '@/modules/ads/dto/claim-reward.dto';
import { StartRewardDto } from '@/modules/ads/dto/start-reward.dto';
import { CurrentGuest } from '@/common/decorators/current-guest.decorator';
import { UpdateAdsConfigDto } from '@/modules/ads/dto/update-ads-config.dto';
import { AdsConfigResponseDto } from '@/modules/ads/dto/ads-config-response.dto';
import { AdsMetricsResponseDto } from '@/modules/ads/dto/ads-metrics-response.dto';
import { ClaimRewardResponseDto } from '@/modules/ads/dto/claim-reward-response.dto';
import { StartRewardResponseDto } from '@/modules/ads/dto/start-reward-response.dto';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get('config')
  async getConfig(): Promise<AdsConfigResponseDto> {
    return this.adsService.getConfig();
  }

  @Post('reward/start')
  @UseGuards(GuestAuthGuard)
  async startReward(
    @Body() dto: StartRewardDto,
    @CurrentGuest() guest: { id: string },
  ): Promise<StartRewardResponseDto> {
    return this.adsService.startReward(guest.id, dto);
  }

  @Post('reward/claim')
  @UseGuards(GuestAuthGuard)
  async claimReward(
    @Body() dto: ClaimRewardDto,
    @CurrentGuest() guest: { id: string },
  ): Promise<ClaimRewardResponseDto> {
    return this.adsService.claimReward(guest.id, dto);
  }

  @Post('events')
  @UseGuards(GuestAuthGuard)
  async logEvent(
    @Body() body: { event: string; metadata?: Record<string, unknown> },
    @CurrentGuest() guest: { id: string },
  ): Promise<{ logged: boolean }> {
    await this.adsService.logClientEvent(guest.id, body.event, body.metadata);
    return { logged: true };
  }
}

@Controller('ads/admin')
export class AdsAdminController {
  constructor(private readonly adsService: AdsService) {}

  @Get('metrics')
  async getMetrics(
    @Headers('x-ads-admin-key') apiKey: string | undefined,
  ): Promise<AdsMetricsResponseDto> {
    this.adsService.verifyAdminKey(apiKey);
    return this.adsService.getMetrics();
  }

  @Get('config')
  async getAdminConfig(
    @Headers('x-ads-admin-key') apiKey: string | undefined,
  ): Promise<AdsConfigResponseDto> {
    this.adsService.verifyAdminKey(apiKey);
    return this.adsService.getConfig();
  }

  @Patch('config')
  async updateConfig(
    @Headers('x-ads-admin-key') apiKey: string | undefined,
    @Body() dto: UpdateAdsConfigDto,
  ): Promise<AdsConfigResponseDto> {
    this.adsService.verifyAdminKey(apiKey);
    return this.adsService.updateConfig(dto);
  }
}
