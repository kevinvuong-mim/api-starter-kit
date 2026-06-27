import { Cron } from '@nestjs/schedule';
import { Logger, Injectable, OnModuleInit } from '@nestjs/common';

import { APP_CONFIG } from '@/common/config/app.config';
import { PrismaService } from '@/modules/prisma/prisma.service';

// Shared transaction-scoped advisory lock key. Serializes partition maintenance across
// app instances and the startup-vs-cron overlap so two runs never DETACH the default
// partition concurrently (which would surface as insert failures during the window).
const PARTITION_MAINTENANCE_LOCK_KEY = 902412;

@Injectable()
export class GameResultsPartitionService implements OnModuleInit {
  private readonly logger = new Logger(GameResultsPartitionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureUpcomingPartitions();
  }

  /** Ensures monthly partitions exist and drops partitions older than retention window. */
  @Cron('0 4 1 * *')
  async maintainPartitions(): Promise<void> {
    await this.ensureUpcomingPartitions();
    await this.dropExpiredPartitions();
  }

  async ensureUpcomingPartitions(monthsAhead = 2): Promise<void> {
    const now = new Date();

    for (let offset = 0; offset <= monthsAhead; offset += 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
      const partitionName = this.partitionName(date);
      const from = this.monthStart(date).toISOString();
      const to = this.monthStart(
        new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)),
      ).toISOString();

      // Detach default → create partition → relocate matching rows out of default → reattach.
      // Required because the default partition may already hold rows in this month's range.
      // The whole block runs in one transaction holding an advisory lock, so the DETACH/ATTACH
      // pair is atomic and concurrent inserts wait on the parent lock instead of failing.
      await this.prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          PERFORM pg_advisory_xact_lock(${PARTITION_MAINTENANCE_LOCK_KEY});

          IF to_regclass('public."${partitionName}"') IS NOT NULL THEN
            RETURN;
          END IF;

          ALTER TABLE "game_results" DETACH PARTITION "game_results_default";

          CREATE TABLE "${partitionName}" PARTITION OF "game_results"
            FOR VALUES FROM ('${from}') TO ('${to}');

          INSERT INTO "game_results"
          SELECT * FROM "game_results_default"
          WHERE "createdAt" >= '${from}' AND "createdAt" < '${to}';

          DELETE FROM "game_results_default"
          WHERE "createdAt" >= '${from}' AND "createdAt" < '${to}';

          ALTER TABLE "game_results" ATTACH PARTITION "game_results_default" DEFAULT;
        END $$;
      `);
    }
  }

  async dropExpiredPartitions(): Promise<void> {
    const retentionMonths = APP_CONFIG.gameResultsRetentionMonths;
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - retentionMonths);

    const rows = await this.prisma.$queryRawUnsafe<Array<{ tablename: string }>>(`
      SELECT c.relname AS tablename
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      WHERE p.relname = 'game_results'
        AND c.relname LIKE 'game_results_%'
        AND c.relname <> 'game_results_default'
    `);

    for (const row of rows) {
      const partitionDate = this.parsePartitionDate(row.tablename);
      if (!partitionDate || partitionDate >= cutoff) {
        continue;
      }

      await this.prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          PERFORM pg_advisory_xact_lock(${PARTITION_MAINTENANCE_LOCK_KEY});
          DROP TABLE IF EXISTS "${row.tablename}";
        END $$;
      `);
      this.logger.log(`Dropped expired partition ${row.tablename}`);
    }
  }

  private partitionName(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `game_results_${year}_${month}`;
  }

  private monthStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private parsePartitionDate(tableName: string): Date | null {
    const match = /^game_results_(\d{4})_(\d{2})$/.exec(tableName);
    if (!match) {
      return null;
    }

    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  }
}
