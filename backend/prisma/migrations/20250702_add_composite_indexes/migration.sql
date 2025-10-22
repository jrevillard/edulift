-- Add composite indexes for invitation validation performance
-- These indexes dramatically improve lookup speed for the validateFamilyInvitation queries

-- Family invitations composite indexes
CREATE INDEX IF NOT EXISTS "family_invitations_inviteCode_status_idx" 
ON "family_invitations"("inviteCode", "status");

CREATE INDEX IF NOT EXISTS "family_invitations_familyId_status_expiresAt_idx" 
ON "family_invitations"("familyId", "status", "expiresAt");

CREATE INDEX IF NOT EXISTS "family_invitations_email_status_expiresAt_idx" 
ON "family_invitations"("email", "status", "expiresAt") 
WHERE "email" IS NOT NULL;

-- Group invitations composite indexes
CREATE INDEX IF NOT EXISTS "group_invitations_inviteCode_status_idx" 
ON "group_invitations"("inviteCode", "status");

CREATE INDEX IF NOT EXISTS "group_invitations_groupId_status_expiresAt_idx" 
ON "group_invitations"("groupId", "status", "expiresAt");

CREATE INDEX IF NOT EXISTS "group_invitations_targetFamilyId_status_expiresAt_idx" 
ON "group_invitations"("targetFamilyId", "status", "expiresAt") 
WHERE "targetFamilyId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "group_invitations_email_status_expiresAt_idx" 
ON "group_invitations"("email", "status", "expiresAt") 
WHERE "email" IS NOT NULL;

-- Optional: Drop redundant single-column indexes if they exist
-- (The composite indexes can serve single-column queries too)
DROP INDEX IF EXISTS "family_invitations_inviteCode_idx";
DROP INDEX IF EXISTS "group_invitations_inviteCode_idx";