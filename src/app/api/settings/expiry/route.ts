import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getExpirySettings, DEFAULT_EXPIRY_SETTINGS } from "@/lib/queries";

export async function GET() {
  try {
    const info = await getExpirySettings();
    return NextResponse.json(info);
  } catch {
    return NextResponse.json(DEFAULT_EXPIRY_SETTINGS);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const warningDays = Number(body.warningDays);

    if (!Number.isFinite(warningDays) || warningDays <= 0) {
      return NextResponse.json({ error: "warningDays must be a positive number" }, { status: 400 });
    }

    const merged = { warningDays };

    await db
      .insert(settings)
      .values({ key: "expiry_warning", value: merged })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: merged, updatedAt: new Date() },
      });

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Expiry settings update failed:", error);
    return NextResponse.json({ error: "Failed to save expiry settings" }, { status: 500 });
  }
}
