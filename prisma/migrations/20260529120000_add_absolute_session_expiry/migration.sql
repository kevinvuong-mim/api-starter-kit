-- Add an absolute 30-day session expiry alongside the existing inactivity window.
ALTER TABLE "sessions" ADD COLUMN "absoluteExpiresAt" TIMESTAMP(3);

UPDATE "sessions"
SET "absoluteExpiresAt" = "createdAt" + INTERVAL '30 days'
WHERE "absoluteExpiresAt" IS NULL;

ALTER TABLE "sessions" ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;

CREATE INDEX "sessions_absoluteExpiresAt_idx" ON "sessions"("absoluteExpiresAt");