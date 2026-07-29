-- Feature 5: Automatic Customer Tracking
--
-- As with 0001, prefer `npx drizzle-kit push` — this file is a reviewable
-- record / manual fallback.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "visit_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_visit_at" timestamp;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_walk_in" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "customers_last_visit_at_idx" ON "customers" ("last_visit_at");
CREATE INDEX IF NOT EXISTS "customers_visit_count_idx" ON "customers" ("visit_count");
