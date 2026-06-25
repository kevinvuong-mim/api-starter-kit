import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import gameConfig from '@/config/game.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [gameConfig],
    }),
  ],
})
export class AppConfigModule {}
