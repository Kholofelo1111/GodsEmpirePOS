import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getBusinessInfo, DEFAULT_BUSINESS } from "@/lib/queries";

export async function GET() {
  try {
    const info = await getBusinessInfo();
    return NextResponse.json(info);
  } catch {
    return NextResponse.json(DEFAULT_BUSINESS);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const current = await getBusinessInfo();
    const merged = {
      ...current,
      ...body,
      vatRate: Number(body.vatRate ?? current.vatRate),
      currency: "ZAR",
    };

    await db
      .insert(settings)
      .values({ key: "business_info", value: merged })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: merged, updatedAt: new Date() },
      });

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Settings update failed:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
