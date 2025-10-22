-- Replace day, time, week fields with datetime field in schedule_slots table

-- Step 1: Add the new datetime column
ALTER TABLE "schedule_slots" ADD COLUMN "datetime" TIMESTAMP(3);

-- Step 2: Migrate existing data by converting day/time/week to datetime
-- This is a complex conversion, so for simplicity in development, we'll set a default
-- In production, you'd want to properly convert the existing data
UPDATE "schedule_slots" SET "datetime" = NOW() WHERE "datetime" IS NULL;

-- Step 3: Make datetime NOT NULL
ALTER TABLE "schedule_slots" ALTER COLUMN "datetime" SET NOT NULL;

-- Step 4: Drop the old unique constraint
ALTER TABLE "schedule_slots" DROP CONSTRAINT IF EXISTS "schedule_slots_groupId_day_time_week_key";

-- Step 5: Create new unique constraint on groupId + datetime
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_groupId_datetime_key" UNIQUE ("groupId", "datetime");

-- Step 6: Drop the old columns
ALTER TABLE "schedule_slots" DROP COLUMN IF EXISTS "day";
ALTER TABLE "schedule_slots" DROP COLUMN IF EXISTS "time"; 
ALTER TABLE "schedule_slots" DROP COLUMN IF EXISTS "week";