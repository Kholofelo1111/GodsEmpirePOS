/**
 * ---------------------------------------------------------------------------
 * AUTHENTICATION MODULE (CURRENTLY DISABLED)
 * ---------------------------------------------------------------------------
 * Authentication is intentionally switched off so the app opens straight into
 * the POS dashboard. Nothing in the UI or API depends on cookies, sessions,
 * middleware or redirects any more.
 *
 * Everything auth-related lives here so it can be re-enabled later with JWT or
 * Supabase Auth by:
 *   1. Setting AUTH_ENABLED = true
 *   2. Implementing `getCurrentUser()` to read the real session
 *   3. Re-adding a /login route + middleware that calls `getCurrentUser()`
 *
 * While AUTH_ENABLED is false, `getCurrentUser()` returns DEFAULT_USER, which
 * is the operator recorded against sales and stock movements.
 * ---------------------------------------------------------------------------
 */

export const AUTH_ENABLED = false;

export type UserRole = "admin" | "cashier";

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
}

/** Operator used for all activity while authentication is disabled. */
export const DEFAULT_USER: SessionUser = {
  id: 1,
  username: "admin",
  fullName: "Store Operator",
  role: "admin",
};

/**
 * Returns the acting user. With auth disabled this is always DEFAULT_USER,
 * so callers never have to handle a null session or perform a redirect.
 */
export async function getCurrentUser(): Promise<SessionUser> {
  if (!AUTH_ENABLED) {
    return DEFAULT_USER;
  }

  // --- Re-enable here later (JWT cookie / Supabase Auth) -------------------
  // const cookieStore = await cookies();
  // const token = cookieStore.get("auth_token")?.value;
  // return token ? await verifyToken(token) : DEFAULT_USER;
  return DEFAULT_USER;
}

/** Permission helper. Always allows while auth is disabled. */
export function can(_action: string, user: SessionUser = DEFAULT_USER): boolean {
  if (!AUTH_ENABLED) return true;
  return user.role === "admin";
}
