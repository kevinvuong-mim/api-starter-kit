import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';

import { APP_CONFIG } from '@/common/config/app.config';
import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class GameReplayKeyRetentionService {
  private readonly logger = new Logger(GameReplayKeyRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Prunes replay dedup keys older than the configured retention window in bounded batches. */
  @Cron('30 4 1 * *')
  async pruneExpiredReplayKeys(): Promise<void> {
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - APP_CONFIG.replayKeyRetentionMonths);

    let deletedTotal = 0;
    let deleted = 0;

    do {
      deleted = await this.deleteBatch(cutoff, APP_CONFIG.replayKeyRetentionBatchSize);
      deletedTotal += deleted;
    } while (deleted === APP_CONFIG.replayKeyRetentionBatchSize);

    if (deletedTotal > 0) {
      this.logger.log(`Pruned ${deletedTotal} expired replay keys`);
    }
  }

  private async deleteBatch(cutoff: Date, batchSize: number): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ gameId: string; replayHash: string }>>`
      SELECT "gameId", "replayHash"
      FROM "game_replay_keys"
      WHERE "createdAt" < ${cutoff}
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
    `;

    if (rows.length === 0) {
      return 0;
    }

    await this.prisma.gameReplayKey.deleteMany({
      where: {
        OR: rows.map((row) => ({
          gameId: row.gameId,
          replayHash: row.replayHash,
        })),
      },
    });

    return rows.length;
  }
}
