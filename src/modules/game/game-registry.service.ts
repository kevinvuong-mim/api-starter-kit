import { Game } from '@prisma/client';
import {
  Logger,
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { ParsedGameConfig, parseGameConfig } from '@/modules/game/game-config.validator';

@Injectable()
export class GameRegistryService implements OnModuleInit {
  private readonly logger = new Logger(GameRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Fail fast on boot: a production game without a replaySecret silently disables HMAC
  // anti-cheat (any well-formed hash would pass), so refuse to start in that state.
  async onModuleInit(): Promise<void> {
    const games = await this.getActiveGames();
    const missing = games.filter((game) => !parseGameConfig(game.config).replaySecret);

    if (missing.length === 0) {
      return;
    }

    const ids = missing.map((game) => game.id).join(', ');
    const message = `Active games missing replaySecret (HMAC anti-cheat disabled): ${ids}`;

    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }

    this.logger.warn(message);
  }

  getActiveGames(): Promise<Game[]> {
    return this.prisma.game.findMany({
      orderBy: { id: 'asc' },
      where: { isActive: true },
    });
  }

  async assertActiveGame(gameId: string): Promise<Game> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });

    if (!game) {
      throw new NotFoundException(`Game "${gameId}" not found`);
    }

    if (!game.isActive) {
      throw new BadRequestException(`Game "${gameId}" is not active`);
    }

    return game;
  }

  getConfig(game: Game): ParsedGameConfig {
    return parseGameConfig(game.config);
  }
}
