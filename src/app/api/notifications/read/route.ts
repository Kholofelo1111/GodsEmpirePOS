import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const { id } = await req.json();

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, id));

  return NextResponse.json({ success: true });
}
