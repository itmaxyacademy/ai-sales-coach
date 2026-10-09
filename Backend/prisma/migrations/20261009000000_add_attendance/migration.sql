CREATE TABLE "attendances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "check_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "check_out_at" TIMESTAMP(3),

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendances_user_id_work_date_key" ON "attendances"("user_id", "work_date");
CREATE INDEX "attendances_work_date_idx" ON "attendances"("work_date");

ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
