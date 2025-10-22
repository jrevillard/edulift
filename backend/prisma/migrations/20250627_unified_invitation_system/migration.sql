-- Migration for Unified Invitation System

-- Add missing fields to existing tables
ALTER TABLE "family_invitations" 
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "acceptedBy" TEXT,
  ADD COLUMN "createdBy" TEXT;

-- Update existing records to have createdBy
UPDATE "family_invitations" 
SET "createdBy" = "invitedBy" 
WHERE "createdBy" IS NULL;

-- Make createdBy required after updating existing records
ALTER TABLE "family_invitations" 
  ALTER COLUMN "createdBy" SET NOT NULL;

-- Add missing fields to group invitations
ALTER TABLE "group_invitations" 
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "targetFamilyId" TEXT,
  ADD COLUMN "acceptedBy" TEXT,
  ADD COLUMN "createdBy" TEXT;

-- Update existing records
UPDATE "group_invitations" 
SET "createdBy" = "invitedBy" 
WHERE "createdBy" IS NULL;

-- Make createdBy required
ALTER TABLE "group_invitations" 
  ALTER COLUMN "createdBy" SET NOT NULL;

-- Create new table for context preservation
CREATE TABLE "pending_user_invitations" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "inviteCode" TEXT NOT NULL,
  "invitationType" TEXT NOT NULL,
  "familyId" TEXT,
  "groupId" TEXT,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "referrer" TEXT,

  CONSTRAINT "pending_user_invitations_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "pending_user_invitations" 
  ADD CONSTRAINT "pending_user_invitations_familyId_fkey" 
  FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE;

ALTER TABLE "pending_user_invitations" 
  ADD CONSTRAINT "pending_user_invitations_groupId_fkey" 
  FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE;

-- Add foreign key for createdBy fields
ALTER TABLE "family_invitations" 
  ADD CONSTRAINT "family_invitations_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "family_invitations" 
  ADD CONSTRAINT "family_invitations_acceptedBy_fkey" 
  FOREIGN KEY ("acceptedBy") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "group_invitations" 
  ADD CONSTRAINT "group_invitations_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "group_invitations" 
  ADD CONSTRAINT "group_invitations_acceptedBy_fkey" 
  FOREIGN KEY ("acceptedBy") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "group_invitations" 
  ADD CONSTRAINT "group_invitations_targetFamilyId_fkey" 
  FOREIGN KEY ("targetFamilyId") REFERENCES "families"("id") ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX "pending_user_invitations_email_idx" ON "pending_user_invitations"("email");
CREATE INDEX "pending_user_invitations_inviteCode_idx" ON "pending_user_invitations"("inviteCode");
CREATE INDEX "pending_user_invitations_expiresAt_idx" ON "pending_user_invitations"("expiresAt");

CREATE INDEX "family_invitations_inviteCode_idx" ON "family_invitations"("inviteCode");
CREATE INDEX "family_invitations_status_idx" ON "family_invitations"("status");
CREATE INDEX "family_invitations_expiresAt_idx" ON "family_invitations"("expiresAt");

CREATE INDEX "group_invitations_inviteCode_idx" ON "group_invitations"("inviteCode");
CREATE INDEX "group_invitations_status_idx" ON "group_invitations"("status");
CREATE INDEX "group_invitations_expiresAt_idx" ON "group_invitations"("expiresAt");
CREATE INDEX "group_invitations_targetFamilyId_idx" ON "group_invitations"("targetFamilyId");

-- Update unique constraints to allow null emails (for public invitations)
ALTER TABLE "family_invitations" DROP CONSTRAINT "family_invitations_familyId_email_key";
CREATE UNIQUE INDEX "family_invitations_familyId_email_key" 
ON "family_invitations"("familyId", "email") 
WHERE "email" IS NOT NULL;

ALTER TABLE "group_invitations" DROP CONSTRAINT "group_invitations_groupId_email_key";
CREATE UNIQUE INDEX "group_invitations_groupId_email_key" 
ON "group_invitations"("groupId", "email") 
WHERE "email" IS NOT NULL;