import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "change-this-secret-in-production"
);

// Origin the locally-bundled Capacitor app is served from, so its
// cross-origin fetches to this API can be allowed with credentials
// (cookies) intact. Capacitor's default Android WebView origin
// (androidScheme: "https", the default) is "https://localhost" — this
// must be verified against the real capacitor.config.ts once an actual
// Android build exists; override via CAPACITOR_APP_ORIGIN if different.
const CAPACITOR_ORIGIN = process.env.CAPACITOR_APP_ORIGIN || "https://localhost";

function withCors(res: NextResponse, origin: string | null): NextResponse {
  if (origin === CAPACITOR_ORIGIN) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin");
  const isApi = pathname.startsWith("/api/");

  // CORS preflight for the bundled app's cross-origin requests. Handled
  // once, centrally, here — not by adding an OPTIONS export to every one
  // of the existing API route files.
  if (isApi && req.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }), origin);
  }

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/me") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return withCors(NextResponse.next(), origin);
  }

  const token = req.cookies.get("auth_token")?.value;

  if (!token) {
    // For API requests, a redirect response is useless to a fetch() caller
    // (and cross-origin redirects don't behave the same way plain page
    // navigation does) — return a real 401 instead. Page navigation keeps
    // the original redirect-to-/login behavior, unchanged.
    if (isApi) return withCors(NextResponse.json({ error: "Not authenticated" }, { status: 401 }), origin);
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, secret);
    return withCors(NextResponse.next(), origin);
  } catch {
    if (isApi) return withCors(NextResponse.json({ error: "Not authenticated" }, { status: 401 }), origin);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
