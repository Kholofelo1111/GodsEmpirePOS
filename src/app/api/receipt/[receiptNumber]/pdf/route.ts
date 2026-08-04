import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { jsPDF } from "jspdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ receiptNumber: string }> }
) {
  const { receiptNumber } = await params;

  const sale = await db.query.sales.findFirst({
    where: eq(schema.sales.receiptNumber, receiptNumber),
  });

  if (!sale) {
    return NextResponse.json(
      { error: "Receipt not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(sale);
}
