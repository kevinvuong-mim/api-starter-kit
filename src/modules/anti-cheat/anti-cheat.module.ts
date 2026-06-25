import { Module } from '@nestjs/common';

import { AntiCheatService } from '@/modules/anti-cheat/anti-cheat.service';

@Module({
  exports: [AntiCheatService],
  providers: [AntiCheatService],
})
export class AntiCheatModule {}
