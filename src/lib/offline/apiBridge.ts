"use client";

/**
 * Once the Capacitor build loads the app bundle locally (see
 * capacitor.config.ts and next.config.ts's "capacitor" build target),
 * the WebView's origin is no longer gods-empire-pos.vercel.app — so every
 * existing `fetch("/api/...")` call in the app (there are dozens, spread
 * across nearly every page) would otherwise try to hit a Next.js server
 * that doesn't exist on the device.
 *
 * Rather than rewrite every call site — which would be a large, risky
 * diff across working POS/Inventory/Staff/etc. code for no functional
 * reason — this installs a single global fetch() interceptor once, at
 * startup, that rewrites only same-origin "/api/..." requests to point
 * at the real backend, and adds `credentials: "include"` so the
 * auth_token cookie still rides along cross-origin. Non-API requests are
 * untouched. On the web deployment (not native), this is a no-op.
 */

const REMOTE_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://gods-empire-pos.vercel.app";

let installed = false;
let installPromise: Promise<void> | null = null;

export function installApiBridge(): Promise<void> {
  if (installPromise) return installPromise;

  installPromise = (async () => {
    if (typeof window === "undefined") return;

    // Only needed for the bundled native build — on web, "/api/..." is
    // already same-origin and needs no rewriting.
    let isNative = false;
    try {
      const { Capacitor } = await import("@capacitor/core");
      isNative = Capacitor.isNativePlatform();
    } catch {
      // @capacitor/core unavailable (shouldn't happen in this project) —
      // leave fetch() untouched rather than break the web build.
      return;
    }
    if (!isNative || installed) return;
    installed = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.startsWith("/api/")) {
        const rewritten = `${REMOTE_API_BASE}${url}`;
        const mergedInit: RequestInit = { ...init, credentials: "include" };
        return originalFetch(rewritten, mergedInit);
      }

      return originalFetch(input, init);
    };
  })();

  return installPromise;
}
