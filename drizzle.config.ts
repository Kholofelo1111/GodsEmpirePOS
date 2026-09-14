import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Was drizzle.config.json with a hardcoded Postgres connection string
// (including a live password) committed directly to source — a real
// secret exposure unrelated to this session's other fixes, found while
// confirming the security requirements below. DATABASE_URL must be set
// in the environment (.env.local for local dev — see .gitignore — or
// GitHub/Vercel secrets in CI/deployment) instead.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local (local dev) or your deployment's environment variables.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
