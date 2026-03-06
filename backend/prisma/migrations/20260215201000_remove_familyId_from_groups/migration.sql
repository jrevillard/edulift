-- Remove familyId column from groups table
-- After migration to normalized ownership, all families (including owners) are stored in group_family_members

-- Drop the foreign key constraint
ALTER TABLE "groups" DROP CONSTRAINT "groups_familyId_fkey";

-- Drop the familyId column
ALTER TABLE "groups" DROP COLUMN "familyId";
