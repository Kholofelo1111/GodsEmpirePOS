import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { SessionUser } from "./auth";

/**
 * Demo mode has no real login, but every insert into sales / stock_in /
 * inventory_logs requires a valid users.id (foreign key). Previously this
 * function just returned a hardcoded `1`, which silently broke every one
 * of those inserts with a foreign-key violation whenever the `users` table
 * didn't already contain a row with id 1 (e.g. any fresh Neon database).
 *
 * This now looks up the demo operator by id, then by username, and creates
 * the row if it's missing — so Stock In / Sales / Product edits work out
 * of the box without manual DB seeding, and keep working once real auth
 * (Feature 13) replaces DEFAULT_USER.
 */
export async function ensureOperator(user: SessionUser): Promise<number> {
  const byId = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (byId.length > 0) return byId[0].id;

  const byUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, user.username))
    .limit(1);
  if (byUsername.length > 0) return byUsername[0].id;

  const [created] = await db
    .insert(users)
    .values({
      username: user.username,
      // Demo mode: no real login flow exists yet, so this password hash
      // is never used to authenticate anyone. Feature 13 replaces this.
      password: "demo-mode-no-login",
      fullName: user.fullName,
      role: user.role,
    })
    .onConflictDoNothing({ target: users.username })
    .returning({ id: users.id });

  if (created) return created.id;

  // Extremely unlikely race: another request created it between our two
  // lookups above and this insert. Fetch what's there now.
  const [fallback] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, user.username))
    .limit(1);

  return fallback?.id ?? user.id;
}
