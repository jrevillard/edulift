-- Add timezone column to User table
-- This is the foundation for all timezone handling in EduLift
-- All existing users will default to 'UTC'

-- Add timezone column with default value 'UTC'
ALTER TABLE "users" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- Create index for faster timezone-based queries (optional but recommended)
CREATE INDEX "users_timezone_idx" ON "users"("timezone");

-- Add comment for documentation
COMMENT ON COLUMN "users"."timezone" IS 'IANA timezone string (e.g., Europe/Paris, America/New_York)';
