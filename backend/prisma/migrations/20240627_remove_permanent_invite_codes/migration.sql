-- Remove permanent invite codes from Family and Group tables
-- This migration implements the unified invitation system by removing
-- the permanent inviteCode fields and using only the FamilyInvitation 
-- and GroupInvitation tables for all invitations.

-- Remove inviteCode from Family table
ALTER TABLE "Family" DROP COLUMN "inviteCode";

-- Remove inviteCode from Group table  
ALTER TABLE "Group" DROP COLUMN "inviteCode";