-- CreateEnum
CREATE TYPE "GuestStatus" AS ENUM ('NORMAL', 'SHADOW', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SeasonType" AS ENUM ('WEEKLY');

-- CreateTable
CREATE TABLE "guest_players" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trustScore" INTEGER NOT NULL DEFAULT 100,
    "status" "GuestStatus" NOT NULL DEFAULT 'NORMAL',

    CONSTRAINT "guest_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_results" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "moves" JSONB NOT NULL,
    "replayHash" TEXT NOT NULL,
    "clientVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "type" "SeasonType" NOT NULL DEFAULT 'WEEKLY',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_global" (
    "guestId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_global_pkey" PRIMARY KEY ("guestId")
);

-- CreateTable
CREATE TABLE "leaderboard_weekly" (
    "guestId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_weekly_pkey" PRIMARY KEY ("guestId","seasonId")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_results_replayHash_key" ON "game_results"("replayHash");

-- CreateIndex
CREATE INDEX "game_results_guestId_idx" ON "game_results"("guestId");

-- CreateIndex
CREATE INDEX "game_results_score_idx" ON "game_results"("score" DESC);

-- CreateIndex
CREATE INDEX "seasons_startedAt_idx" ON "seasons"("startedAt");

-- CreateIndex
CREATE INDEX "leaderboard_global_bestScore_idx" ON "leaderboard_global"("bestScore" DESC);

-- CreateIndex
CREATE INDEX "leaderboard_weekly_bestScore_idx" ON "leaderboard_weekly"("bestScore" DESC);

-- CreateIndex
CREATE INDEX "leaderboard_weekly_seasonId_idx" ON "leaderboard_weekly"("seasonId");

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_global" ADD CONSTRAINT "leaderboard_global_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_weekly" ADD CONSTRAINT "leaderboard_weekly_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_weekly" ADD CONSTRAINT "leaderboard_weekly_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
