import { Module } from '@nestjs/common';

import { GameRegistryService } from '@/modules/game/game-registry.service';

@Module({
  providers: [GameRegistryService],
  exports: [GameRegistryService],
})
export class GameRegistryModule {}
