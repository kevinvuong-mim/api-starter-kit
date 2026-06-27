import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

interface RegisterGameOptions {
  id: string;
  name: string;
  maxScore: number;
  replaySecret: string;
  playedAtMaxAgeDays: number;
  playedAtFutureSkewMs: number;
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function requireArg(name: string): string {
  const value = readArg(name);
  if (!value) {
    throw new Error(`Missing required argument --${name}=...`);
  }
  return value;
}

function readNumberArg(name: string, fallback: number): number {
  const value = readArg(name);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number`);
  }

  return Math.floor(parsed);
}

function parseOptions(): RegisterGameOptions {
  return {
    id: requireArg('id'),
    name: readArg('name') ?? requireArg('id'),
    maxScore: readNumberArg('maxScore', 100_000),
    replaySecret: readArg('replaySecret') ?? randomBytes(32).toString('hex'),
    playedAtMaxAgeDays: readNumberArg('playedAtMaxAgeDays', 30),
    playedAtFutureSkewMs: readNumberArg('playedAtFutureSkewMs', 5 * 60 * 1000),
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const prisma = new PrismaClient();

  try {
    const game = await prisma.game.upsert({
      where: { id: options.id },
      create: {
        id: options.id,
        name: options.name,
        isActive: true,
        config: {
          maxScore: options.maxScore,
          replaySecret: options.replaySecret,
          playedAtMaxAgeDays: options.playedAtMaxAgeDays,
          playedAtFutureSkewMs: options.playedAtFutureSkewMs,
        },
      },
      update: {
        name: options.name,
        isActive: true,
        config: {
          maxScore: options.maxScore,
          replaySecret: options.replaySecret,
          playedAtMaxAgeDays: options.playedAtMaxAgeDays,
          playedAtFutureSkewMs: options.playedAtFutureSkewMs,
        },
      },
    });

    console.log(`Registered game "${game.id}".`);
    console.log(
      JSON.stringify(
        {
          id: game.id,
          name: game.name,
          maxScore: options.maxScore,
          replaySecret: options.replaySecret,
          playedAtMaxAgeDays: options.playedAtMaxAgeDays,
          playedAtFutureSkewMs: options.playedAtFutureSkewMs,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
