import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_USER, type SessionUser } from "./auth";

/**
 * Sales, stock movements and inventory logs have a foreign key to `users`.
 * With authentication disabled we still need a valid row to attribute activity
 * to, so this makes sure the default operator exists and returns its id.
 *
 * When auth is re-enabled this simply returns the authenticated user's id.
 */
export async function ensureOperator(user: SessionUser = DEFAULT_USER): Promise<number> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, user.username));
  if (existing) return existing.id;

  const [created] = await db
    .insert(users)
    .values({
      username: user.username,
      // Placeholder: no password is used while authentication is disabled.
      password: "disabled",
      fullName: user.fullName,
      role: user.role,
    })
    .onConflictDoNothing()
    .returning({ id: users.id });

  if (created) return created.id;

  const [fallback] = await db.select({ id: users.id }).from(users).limit(1);
  return fallback?.id ?? 1;
}
