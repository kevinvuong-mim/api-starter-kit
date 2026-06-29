/* eslint-disable no-console */

import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

interface RegisterGameOptions {
  id: string;
  name: string;
  replaySecret: string;
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

function parseOptions(): RegisterGameOptions {
  return {
    id: requireArg('id'),
    name: readArg('name') ?? requireArg('id'),
    replaySecret: readArg('replaySecret') ?? randomBytes(32).toString('hex'),
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
        config: {
          replaySecret: options.replaySecret,
        },
      },
      update: {
        name: options.name,
        config: {
          replaySecret: options.replaySecret,
        },
      },
    });

    console.log(`Registered game "${game.id}".`);
    console.log(
      JSON.stringify(
        {
          id: game.id,
          name: game.name,
          replaySecret: options.replaySecret,
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
