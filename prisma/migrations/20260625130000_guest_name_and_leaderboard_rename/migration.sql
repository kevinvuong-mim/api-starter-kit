-- Add player name to guest_players
ALTER TABLE "guest_players" ADD COLUMN "name" TEXT;

-- Rename leaderboard_global -> leaderboard
ALTER TABLE "leaderboard_global" RENAME TO "leaderboard";
ALTER TABLE "leaderboard" RENAME CONSTRAINT "leaderboard_global_pkey" TO "leaderboard_pkey";
ALTER INDEX "leaderboard_global_gameId_bestScore_idx" RENAME TO "leaderboard_gameId_bestScore_idx";
ALTER TABLE "leaderboard" RENAME CONSTRAINT "leaderboard_global_gameId_fkey" TO "leaderboard_gameId_fkey";
ALTER TABLE "leaderboard" RENAME CONSTRAINT "leaderboard_global_guestId_fkey" TO "leaderboard_guestId_fkey";
