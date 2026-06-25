import { Module } from '@nestjs/common';

import { ReplayService } from '@/modules/replay/replay.service';

@Module({
  exports: [ReplayService],
  providers: [ReplayService],
})
export class ReplayModule {}
