"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import AppShell from "./AppShell";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth";
import { getCurrentLocalSession, clearCurrentLocalSession } from "@/lib/offline/localAuth";
import { installApiBridge } from "@/lib/offline/apiBridge";

/**
 * Was a server component using cookies() directly. Converted to a client
 * check so this (and every page it wraps) can be part of a static export
 * bundle for the Capacitor build — see the Hybrid Offline architecture
 * report. Behavior, online, is unchanged: /api/auth/me still reads the
 * same auth_token cookie server-side; this component just calls it via
 * fetch instead of importing getCurrentUser() directly.
 *
 * Offline fallback: if /api/auth/me can't be reached at all (no
 * connection — not the same as a 401, which means "not logged in" and
 * still routes to /login), fall back to the last local session recorded
 * on this device by localAuth.ts. This does not re-validate isActive/role
 * against the server while offline — see the offline-auth report for why.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    installApiBridge().then(() =>
      fetch("/api/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          return { online: true, user: data.user as SessionUser | null };
        }
        // Reached the server, and it said "not logged in" — this is
        // authoritative, not a connectivity failure.
        return { online: true, user: null };
      })
      .catch(() => ({ online: false, user: null as SessionUser | null }))
      .then(({ online, user: serverUser }) => {
        if (cancelled) return;

        if (online) {
          if (serverUser) {
            setUser(serverUser);
          } else {
            clearCurrentLocalSession();
            if (pathname !== "/login") router.replace("/login");
          }
          setChecked(true);
          return;
        }

        // Offline — fall back to the last known local session.
        const local = getCurrentLocalSession();
        if (local) {
          setUser({ id: local.userId, username: local.username, fullName: local.fullName, role: local.role });
        } else if (pathname !== "/login") {
          router.replace("/login");
        }
        setChecked(true);
      })
    );

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!checked || !user) {
    // Deliberately minimal — avoids importing the full Spinner/UI kit
    // into the very first thing that renders on every route.
    return <div className="min-h-screen bg-dark-950" />;
  }

  return <AppShell user={user}>{children}</AppShell>;
}
