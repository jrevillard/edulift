-- AlterEnum
ALTER TYPE "GroupRole" ADD VALUE 'OWNER';

-- DropForeignKey
ALTER TABLE "schedule_slot_vehicles" DROP CONSTRAINT "schedule_slot_vehicles_driverId_fkey";

-- DropIndex
DROP INDEX "secure_tokens_type_token_idx";

-- DropIndex
DROP INDEX "secure_tokens_type_userId_expiresAt_idx";

-- AlterTable
ALTER TABLE "secure_tokens" ALTER COLUMN "type" SET DEFAULT 'MAGIC_LINK';

-- CreateIndex
CREATE INDEX "secure_tokens_userId_type_used_expiresAt_idx" ON "secure_tokens"("userId", "type", "used", "expiresAt");

-- CreateIndex
CREATE INDEX "secure_tokens_type_used_expiresAt_idx" ON "secure_tokens"("type", "used", "expiresAt");

-- AddForeignKey
ALTER TABLE "schedule_slot_vehicles" ADD CONSTRAINT "schedule_slot_vehicles_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
