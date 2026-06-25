-- DropEnum (old schema)
DROP TABLE IF EXISTS "leaderboard_weekly" CASCADE;
DROP TABLE IF EXISTS "leaderboard_global" CASCADE;
DROP TABLE IF EXISTS "game_results" CASCADE;
DROP TABLE IF EXISTS "seasons" CASCADE;
DROP TABLE IF EXISTS "guest_players" CASCADE;
DROP TYPE IF EXISTS "GuestStatus";
DROP TYPE IF EXISTS "SeasonType";

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_players" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_results" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "replayHash" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_global" (
    "gameId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_global_pkey" PRIMARY KEY ("gameId","guestId")
);

-- CreateTable
CREATE TABLE "leaderboard_weekly" (
    "gameId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_weekly_pkey" PRIMARY KEY ("gameId","seasonId","guestId")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_results_gameId_replayHash_key" ON "game_results"("gameId", "replayHash");

-- CreateIndex
CREATE INDEX "game_results_gameId_guestId_idx" ON "game_results"("gameId", "guestId");

-- CreateIndex
CREATE INDEX "game_results_gameId_score_idx" ON "game_results"("gameId", "score" DESC);

-- CreateIndex
CREATE INDEX "seasons_gameId_startAt_idx" ON "seasons"("gameId", "startAt");

-- CreateIndex
CREATE INDEX "seasons_gameId_endAt_idx" ON "seasons"("gameId", "endAt");

-- CreateIndex
CREATE INDEX "leaderboard_global_gameId_bestScore_idx" ON "leaderboard_global"("gameId", "bestScore" DESC);

-- CreateIndex
CREATE INDEX "leaderboard_weekly_gameId_seasonId_bestScore_idx" ON "leaderboard_weekly"("gameId", "seasonId", "bestScore" DESC);

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_global" ADD CONSTRAINT "leaderboard_global_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_global" ADD CONSTRAINT "leaderboard_global_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_weekly" ADD CONSTRAINT "leaderboard_weekly_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_weekly" ADD CONSTRAINT "leaderboard_weekly_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_weekly" ADD CONSTRAINT "leaderboard_weekly_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default games
INSERT INTO "games" ("id", "name", "isActive") VALUES
  ('puzzle-quest', 'Puzzle Quest', true),
  ('arcade-rush', 'Arcade Rush', true);
