-- Platform hardening (idempotent)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "guest_players" ADD COLUMN IF NOT EXISTS "installId" TEXT;
ALTER TABLE "guest_players" ADD COLUMN IF NOT EXISTS "sessionTokenHash" TEXT;
ALTER TABLE "guest_players" ADD COLUMN IF NOT EXISTS "sessionTokenExpiresAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'guest_players'
      AND column_name = 'sessionToken'
  ) THEN
    UPDATE "guest_players"
    SET
      "sessionTokenHash" = encode(digest("sessionToken", 'sha256'), 'hex'),
      "sessionTokenExpiresAt" = COALESCE("sessionTokenExpiresAt", NOW() + INTERVAL '90 days')
    WHERE "sessionTokenHash" IS NULL;

    ALTER TABLE "guest_players" DROP COLUMN "sessionToken";
  END IF;
END $$;

UPDATE "guest_players"
SET
  "sessionTokenHash" = encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'),
  "sessionTokenExpiresAt" = COALESCE("sessionTokenExpiresAt", NOW() + INTERVAL '90 days')
WHERE "sessionTokenHash" IS NULL;

ALTER TABLE "guest_players" ALTER COLUMN "sessionTokenHash" SET NOT NULL;
ALTER TABLE "guest_players" ALTER COLUMN "sessionTokenExpiresAt" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "guest_players_installId_key" ON "guest_players"("installId");
CREATE UNIQUE INDEX IF NOT EXISTS "guest_players_sessionTokenHash_key" ON "guest_players"("sessionTokenHash");

CREATE TABLE IF NOT EXISTS "game_replay_keys" (
    "gameId" TEXT NOT NULL,
    "replayHash" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_replay_keys_pkey" PRIMARY KEY ("gameId","replayHash")
);

CREATE INDEX IF NOT EXISTS "game_replay_keys_guestId_idx" ON "game_replay_keys"("guestId");

INSERT INTO "game_replay_keys" ("gameId", "replayHash", "guestId", "score", "createdAt")
SELECT "gameId", "replayHash", "guestId", "score", "createdAt"
FROM "game_results"
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    WHERE c.relname = 'game_results'
  ) THEN
    RETURN;
  END IF;

  IF to_regclass('public.game_results_legacy') IS NOT NULL THEN
    DROP TABLE IF EXISTS "game_results_legacy";
  END IF;

  ALTER TABLE "game_results" RENAME TO "game_results_legacy";
  ALTER TABLE "game_results_legacy" RENAME CONSTRAINT "game_results_pkey" TO "game_results_legacy_pkey";

  CREATE TABLE "game_results" (
      "id" TEXT NOT NULL,
      "gameId" TEXT NOT NULL,
      "guestId" TEXT NOT NULL,
      "score" INTEGER NOT NULL,
      "replayHash" TEXT NOT NULL,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "game_results_pkey" PRIMARY KEY ("id", "createdAt")
  ) PARTITION BY RANGE ("createdAt");

  CREATE TABLE "game_results_default" PARTITION OF "game_results" DEFAULT;

  INSERT INTO "game_results" ("id", "gameId", "guestId", "score", "replayHash", "metadata", "createdAt")
  SELECT "id", "gameId", "guestId", "score", "replayHash", "metadata", "createdAt"
  FROM "game_results_legacy";

  DROP TABLE "game_results_legacy";

  CREATE INDEX IF NOT EXISTS "game_results_gameId_guestId_idx" ON "game_results" ("gameId", "guestId");
  CREATE INDEX IF NOT EXISTS "game_results_gameId_createdAt_idx" ON "game_results" ("gameId", "createdAt");

  ALTER TABLE "game_results" ADD CONSTRAINT "game_results_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "game_results" ADD CONSTRAINT "game_results_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

UPDATE "games"
SET "config" = COALESCE("config", '{}'::jsonb) || '{"maxScore": 10000000}'::jsonb
WHERE "config" IS NULL OR NOT ("config" ? 'maxScore');
