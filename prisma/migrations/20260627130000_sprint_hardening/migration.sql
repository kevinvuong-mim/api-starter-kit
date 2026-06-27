-- Sprint hardening: installSecret, playedAt, game config, leaderboard tie-break index

ALTER TABLE "guest_players" ADD COLUMN IF NOT EXISTS "installSecretHash" TEXT;

ALTER TABLE "game_results" ADD COLUMN IF NOT EXISTS "playedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "game_results_gameId_replayHash_idx"
  ON "game_results" ("gameId", "replayHash");

DROP INDEX IF EXISTS "leaderboard_gameId_bestScore_idx";
CREATE INDEX IF NOT EXISTS "leaderboard_gameId_bestScore_guestId_idx"
  ON "leaderboard" ("gameId", "bestScore" DESC, "guestId" ASC);

INSERT INTO "games" ("id", "name", "isActive", "config")
VALUES
  ('puzzle-quest', 'Puzzle Quest', true, '{"maxScore": 50000, "replaySecret": "puzzle-quest-dev-secret"}'::jsonb),
  ('arcade-rush', 'Arcade Rush', true, '{"maxScore": 100000, "replaySecret": "arcade-rush-dev-secret"}'::jsonb)
ON CONFLICT ("id") DO UPDATE SET
  "config" = EXCLUDED."config",
  "isActive" = EXCLUDED."isActive";
