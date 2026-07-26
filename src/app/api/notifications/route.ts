import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const data = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt));

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}
