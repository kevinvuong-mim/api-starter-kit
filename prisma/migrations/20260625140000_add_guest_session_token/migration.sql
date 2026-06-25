-- Add session token for guest authentication
ALTER TABLE "guest_players" ADD COLUMN "sessionToken" TEXT;

UPDATE "guest_players" SET "sessionToken" = gen_random_uuid()::text WHERE "sessionToken" IS NULL;

ALTER TABLE "guest_players" ALTER COLUMN "sessionToken" SET NOT NULL;

CREATE UNIQUE INDEX "guest_players_sessionToken_key" ON "guest_players"("sessionToken");
