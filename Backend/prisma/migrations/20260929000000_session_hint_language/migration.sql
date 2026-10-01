-- Persist hint cooldown timestamps and session/course language
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "last_hint_at" TIMESTAMP(3);
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'id';
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "default_language" TEXT NOT NULL DEFAULT 'id';
