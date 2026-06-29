import { Cron } from '@nestjs/schedule';
import { Logger, Injectable, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '@/modules/prisma/prisma.service';

// Shared transaction-scoped advisory lock key. Serializes partition maintenance across
// app instances and the startup-vs-cron overlap so two runs never create the same
// partition concurrently.
const PARTITION_MAINTENANCE_LOCK_KEY = 902412;

@Injectable()
export class GameResultsPartitionService implements OnModuleInit {
  private readonly logger = new Logger(GameResultsPartitionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureUpcomingPartitions();
  }

  /** Ensures yearly partitions exist. Partitions are retained indefinitely. */
  @Cron('0 4 1 1 *')
  async maintainPartitions() {
    await this.ensureUpcomingPartitions();
  }

  async ensureUpcomingPartitions(yearsAhead = 1) {
    const now = new Date();

    for (let offset = 0; offset <= yearsAhead; offset += 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear() + offset, 0, 1));
      const partitionName = this.partitionName(date);
      const from = this.yearStart(date).toISOString();
      const to = this.yearStart(new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1))).toISOString();

      await this.prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          PERFORM pg_advisory_xact_lock(${PARTITION_MAINTENANCE_LOCK_KEY});

          IF to_regclass('public."${partitionName}"') IS NOT NULL THEN
            RETURN;
          END IF;

          CREATE TABLE "${partitionName}" PARTITION OF "game_results"
            FOR VALUES FROM ('${from}') TO ('${to}');
        END $$;
      `);

      this.logger.log(`Ensured game_results yearly partition ${partitionName}`);
    }
  }

  private partitionName(date: Date) {
    const year = date.getUTCFullYear();
    return `game_results_${year}`;
  }

  private yearStart(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  }
}
