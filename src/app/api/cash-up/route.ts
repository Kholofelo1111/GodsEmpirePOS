import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getCashUpDay } from "@/lib/queries";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["owner", "manager"]);

    const date = req.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "A valid ?date=YYYY-MM-DD is required." }, { status: 400 });
    }

    const summary = await getCashUpDay(date);
    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: "You do not have permission to view cash-up." }, { status: 403 });
    }
    console.error("GET /api/cash-up failed:", err);
    return NextResponse.json({ error: "Failed to load cash-up summary." }, { status: 500 });
  }
}
