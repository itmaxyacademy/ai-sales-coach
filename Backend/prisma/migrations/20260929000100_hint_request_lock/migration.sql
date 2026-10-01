ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "hint_request_started_at" TIMESTAMP(3);
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "has_started" BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE "sessions" SET "has_started" = FALSE WHERE "status" = 'active' AND "turn_count" = 0;
