import { Get, Controller } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { AppService } from '@/app.service';
import { HealthService } from '@/health.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly healthService: HealthService,
  ) {}

  @SkipThrottle()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @SkipThrottle()
  @Get('health')
  getHealth() {
    return this.healthService.check();
  }
}
