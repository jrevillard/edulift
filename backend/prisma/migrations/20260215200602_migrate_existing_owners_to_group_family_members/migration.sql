-- Migrate existing group owners to group_family_members table with OWNER role
-- Step 1: Insert all group owners into group_family_members with OWNER role
INSERT INTO "group_family_members" ("familyId", "groupId", "role", "addedBy", "joinedAt")
SELECT
  g."familyId",
  g.id as "groupId",
  'OWNER',
  -- Find a user from this family to use as addedBy (first user we find)
  (SELECT fm."userId" FROM "family_members" fm WHERE fm."familyId" = g."familyId" LIMIT 1),
  g."createdAt" as "joinedAt"
FROM "groups" g
WHERE NOT EXISTS (
  -- Avoid duplicates if migration is re-run
  SELECT 1
  FROM "group_family_members" gfm
  WHERE gfm."groupId" = g.id AND gfm."familyId" = g."familyId"
);

-- Step 2: Create index for performance on role column
CREATE INDEX IF NOT EXISTS "group_family_members_role_idx" ON "group_family_members"("role");
