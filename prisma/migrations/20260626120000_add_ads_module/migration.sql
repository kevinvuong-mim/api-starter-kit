-- CreateEnum
CREATE TYPE "AdRewardSessionStatus" AS ENUM ('PENDING', 'CLAIMED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "ad_reward_sessions" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "provider" TEXT,
    "status" "AdRewardSessionStatus" NOT NULL DEFAULT 'PENDING',
    "rewardType" TEXT,
    "rewardAmount" INTEGER,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_reward_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_events" (
    "id" TEXT NOT NULL,
    "guestId" TEXT,
    "provider" TEXT,
    "placement" TEXT,
    "event" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_reward_sessions_idempotencyKey_key" ON "ad_reward_sessions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ad_reward_sessions_guestId_placement_idx" ON "ad_reward_sessions"("guestId", "placement");

-- CreateIndex
CREATE INDEX "ad_reward_sessions_guestId_status_idx" ON "ad_reward_sessions"("guestId", "status");

-- CreateIndex
CREATE INDEX "ad_reward_sessions_status_expiresAt_idx" ON "ad_reward_sessions"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ad_events_event_createdAt_idx" ON "ad_events"("event", "createdAt");

-- CreateIndex
CREATE INDEX "ad_events_guestId_createdAt_idx" ON "ad_events"("guestId", "createdAt");

-- CreateIndex
CREATE INDEX "ad_events_placement_event_idx" ON "ad_events"("placement", "event");

-- AddForeignKey
ALTER TABLE "ad_reward_sessions" ADD CONSTRAINT "ad_reward_sessions_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
