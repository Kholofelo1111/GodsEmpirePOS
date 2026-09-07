import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "This account has been deactivated. Contact the owner." }, { status: 403 });
    }

    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const token = await createToken({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    });

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
      },
    });

    res.cookies.set("auth_token", token, {
      httpOnly: true,
      // SameSite=Lax cookies are not sent on cross-site fetch/XHR requests
      // — only on top-level navigation. The bundled Capacitor app's origin
      // (see capacitor.config.ts / apiBridge.ts) is different from this
      // API's origin, so every request after login was cross-site, and
      // Lax was silently dropping the cookie: login would report success,
      // but the very next request (even /api/auth/me) had no cookie to
      // send, looked unauthenticated, and bounced back to /login — the
      // observed "online login loop" and "Not authenticated" on product
      // creation. SameSite=None (required: only valid together with
      // Secure) fixes this for the deployed/production origin. Local
      // `next dev` over plain http is same-origin already (no cross-site
      // request involved) and stays on Lax/non-secure so cookies keep
      // working without HTTPS in local development.
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
