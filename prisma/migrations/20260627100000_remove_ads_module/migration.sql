-- DropForeignKey
ALTER TABLE "ad_reward_sessions" DROP CONSTRAINT "ad_reward_sessions_guestId_fkey";
ALTER TABLE "ad_events" DROP CONSTRAINT "ad_events_guestId_fkey";

-- DropTable
DROP TABLE "ad_reward_sessions";
DROP TABLE "ad_events";
DROP TABLE "ad_config";

-- DropEnum
DROP TYPE "AdRewardSessionStatus";
