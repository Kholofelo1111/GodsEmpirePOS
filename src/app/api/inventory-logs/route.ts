import { NextResponse } from "next/server";
import { getRecentMovements } from "@/lib/queries";

export async function GET() {
  try {
    const movements = await getRecentMovements(50);
    return NextResponse.json(movements);
  } catch (error) {
    console.error("Failed to fetch movements:", error);
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 });
  }
}
