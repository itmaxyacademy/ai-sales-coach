-- Add hint_count column to sessions table (missing from initial migration)
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "hint_count" INTEGER NOT NULL DEFAULT 0;
