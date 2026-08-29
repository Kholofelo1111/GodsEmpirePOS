"use client";

/**
 * Offline authentication (Phase 4 / audit section F).
 *
 * IMPORTANT — this module is currently unreachable in production. It only
 * matters once the Capacitor shell loads the app bundle locally (audit
 * section D/K, "Phase 2"), which has not been implemented yet: today,
 * with zero connectivity, the WebView can't fetch the login page at all,
 * so this code never runs. It's built now, ahead of that dependency,
 * because it's self-contained and reviewable on its own — see the final
 * chat report for the honest status of what's wired up vs. not.
 *
 * Design (see audit section F for the reasoning):
 *  - After a normal ONLINE login succeeds, provisionLocalSession() derives
 *    a PBKDF2 hash of the password with a random per-record salt, using
 *    the browser's native WebCrypto (no new dependency). This is a
 *    SEPARATE hash from Postgres's bcrypt hash — the server's real
 *    password hash is never sent to or stored on the device.
 *  - verifyLocalLogin() re-derives the same hash from an entered password
 *    and compares, entirely on-device, for offline login.
 *  - Local sessions carry role/isActive as of their last online login —
 *    they are NOT re-validated against the server while offline (can't
 *    be, by definition), so a very recently deactivated account could
 *    still get local access until the next successful online sync. This
 *    is called out explicitly, not hidden, and matches the requirement
 *    to reconcile against the server as soon as connectivity returns.
 */

import { STORES, openDb } from "./db";

const SESSION_STORE = STORES.localSessions;
const PBKDF2_ITERATIONS = 100_000;

export interface LocalSessionRecord {
  userId: number;
  username: string;
  fullName: string;
  displayName: string | null;
  role: "owner" | "manager" | "cashier";
  isActive: boolean;
  saltHex: string;
  hashHex: string;
  provisionedAt: string;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    // `salt as BufferSource`: a TypeScript-lib-version typing mismatch only
    // (some lib.dom.d.ts / @types/node combinations type Uint8Array as
    // Uint8Array<ArrayBufferLike> while WebCrypto's BufferSource expects
    // Uint8Array<ArrayBuffer>) — the actual bytes passed to PBKDF2 are
    // unchanged. Algorithm, iteration count, hash, and salt representation
    // are all exactly as before.
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toHex(bits);
}

// Uses the same single IndexedDB connection/version as db.ts (openDb) —
// see the comment there. Do not open this database a third way anywhere
// else in the codebase.

/**
 * Call this right after a successful ONLINE login, while the plaintext
 * password is still in memory (it is never persisted — only its derived
 * hash is stored).
 */
export async function provisionLocalSession(
  user: {
    id: number;
    username: string;
    fullName: string;
    displayName?: string | null;
    role: "owner" | "manager" | "cashier";
    isActive?: boolean;
  },
  password: string
): Promise<void> {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hashHex = await derive(password, salt);
    const record: LocalSessionRecord = {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      displayName: user.displayName ?? null,
      role: user.role,
      isActive: user.isActive ?? true,
      saltHex: toHex(salt.buffer as ArrayBuffer),
      hashHex,
      provisionedAt: new Date().toISOString(),
    };
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, "readwrite");
      tx.objectStore(SESSION_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // Non-fatal — the user is still logged in online; they just won't be
    // able to log in offline until the next successful online login.
    console.warn("Could not provision local offline session:", err);
  }
}

export type LocalLoginResult =
  | { ok: true; user: Omit<LocalSessionRecord, "saltHex" | "hashHex"> }
  | { ok: false; reason: "not_provisioned" | "wrong_password" | "inactive" };

/**
 * Verifies a username/password against the locally-stored verifier only.
 * Never contacts the network — this is the offline path.
 */
export async function verifyLocalLogin(username: string, password: string): Promise<LocalLoginResult> {
  const db = await openDb();
  const record = await new Promise<LocalSessionRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readonly");
    const req = tx.objectStore(SESSION_STORE).get(username);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!record) return { ok: false, reason: "not_provisioned" };

  const candidateHash = await derive(password, fromHex(record.saltHex));
  if (candidateHash !== record.hashHex) return { ok: false, reason: "wrong_password" };

  // isActive reflects the status as of the last online login — see the
  // module-level note above on why this can't be re-verified offline.
  if (!record.isActive) return { ok: false, reason: "inactive" };

  const { saltHex, hashHex, ...user } = record;
  return { ok: true, user };
}

export async function clearLocalSession(username: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readwrite");
  tx.objectStore(SESSION_STORE).delete(username);
}

// ---- "Who is currently logged in on this device" pointer ----
//
// Separate from the per-user provisioned credential records above: this
// is a small, synchronous localStorage pointer set on every successful
// login (online or offline) so a cold start knows who to treat as
// logged-in without asking for credentials again every launch. It only
// carries what AppShell/role-gating needs to render — never a password
// or its hash.

const CURRENT_SESSION_KEY = "godsempire_current_session";

export interface CurrentLocalSession {
  userId: number;
  username: string;
  fullName: string;
  displayName: string | null;
  role: "owner" | "manager" | "cashier";
}

export function setCurrentLocalSession(user: CurrentLocalSession): void {
  try {
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(user));
  } catch {
    // Storage unavailable — the device just won't remember the session
    // across a full app restart; not fatal to the current session.
  }
}

export function getCurrentLocalSession(): CurrentLocalSession | null {
  try {
    const raw = localStorage.getItem(CURRENT_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCurrentLocalSession(): void {
  try {
    localStorage.removeItem(CURRENT_SESSION_KEY);
  } catch {
    // Nothing to do — worst case a stale pointer remains, which the next
    // online /api/auth/me check will simply override anyway.
  }
}
