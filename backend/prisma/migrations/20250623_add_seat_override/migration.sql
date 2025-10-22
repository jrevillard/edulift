-- AlterTable: Add seatOverride field to schedule_slot_vehicles table
ALTER TABLE "schedule_slot_vehicles" ADD COLUMN "seatOverride" INTEGER;

-- Add comment for the new column
COMMENT ON COLUMN "schedule_slot_vehicles"."seatOverride" IS 'Override the default vehicle capacity for this specific assignment';