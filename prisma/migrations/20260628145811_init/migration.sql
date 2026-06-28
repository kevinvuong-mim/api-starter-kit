-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_players" (
    "id" TEXT NOT NULL,
    "installId" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_results" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "replayHash" TEXT NOT NULL,
    "metadata" JSONB,
    "playedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("id","createdAt")
) PARTITION BY RANGE ("createdAt");

-- CreateTable
CREATE TABLE "leaderboard" (
    "gameId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_pkey" PRIMARY KEY ("gameId","guestId")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_players_installId_key" ON "guest_players"("installId");

-- CreateIndex
CREATE INDEX "game_results_gameId_guestId_idx" ON "game_results"("gameId", "guestId");

-- CreateIndex
CREATE INDEX "game_results_gameId_createdAt_idx" ON "game_results"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "game_results_gameId_replayHash_idx" ON "game_results"("gameId", "replayHash");

-- CreateIndex
CREATE INDEX "leaderboard_gameId_bestScore_guestId_idx" ON "leaderboard"("gameId", "bestScore" DESC, "guestId" ASC);

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard" ADD CONSTRAINT "leaderboard_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard" ADD CONSTRAINT "leaderboard_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
