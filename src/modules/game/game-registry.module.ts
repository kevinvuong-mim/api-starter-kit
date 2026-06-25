import { Module } from '@nestjs/common';

import { GameRegistryService } from '@/modules/game/game-registry.service';

@Module({
  exports: [GameRegistryService],
  providers: [GameRegistryService],
})
export class GameRegistryModule {}
