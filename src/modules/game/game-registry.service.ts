import { Game } from '@prisma/client';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class GameRegistryService {
  constructor(private readonly prisma: PrismaService) {}

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
}
