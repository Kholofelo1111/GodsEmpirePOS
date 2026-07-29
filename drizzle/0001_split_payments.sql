-- Feature 6: Split Payment
--
-- This project has been managed with `drizzle-kit push` (no prior
-- migrations folder existed), so the simplest path is usually:
--
--     npx drizzle-kit push
--
-- This file is provided as an explicit, reviewable record of exactly what
-- that push will do, and as a manual fallback if you'd rather run SQL
-- directly against Neon.

-- 1. Add new payment methods to the existing enum used by sales.payment_method
ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'split';
ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'eft';
ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'voucher';

-- 2. New enum for individual payment legs within a (possibly split) sale
DO $$ BEGIN
  CREATE TYPE "payment_component" AS ENUM ('cash', 'card', 'eft', 'voucher');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. One row per payment leg. A normal sale gets exactly one row; a split
--    payment (e.g. Cash R25 + Card R25) gets one row per method.
CREATE TABLE IF NOT EXISTS "sale_payments" (
  "id" serial PRIMARY KEY,
  "sale_id" integer NOT NULL REFERENCES "sales"("id"),
  "method" "payment_component" NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sale_payments_sale_id_idx" ON "sale_payments" ("sale_id");

-- Note: ALTER TYPE ... ADD VALUE cannot run inside the same transaction as
-- a statement that uses the new value, but this file only adds values —
-- it doesn't use them — so it's safe to run as-is via `psql` or Neon's
-- SQL editor. If your migration runner wraps every file in one
-- transaction and errors on this, run the three ALTER TYPE lines
-- separately first, then the rest of the file.
