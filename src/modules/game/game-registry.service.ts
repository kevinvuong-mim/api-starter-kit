import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Game } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class GameRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  getActiveGames(): Promise<Game[]> {
    return this.prisma.game.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
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
}
