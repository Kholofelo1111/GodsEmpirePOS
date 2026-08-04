import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, sales } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customerId = Number(id);

    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const history = await db
      .select({
        id: sales.id,
        receiptNumber: sales.receiptNumber,
        total: sales.total,
        paymentMethod: sales.paymentMethod,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .where(eq(sales.customerId, customerId))
      .orderBy(desc(sales.createdAt))
      .limit(25);

    const [totals] = await db
      .select({
        spent: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
        visits: sql<number>`COUNT(*)::int`,
      })
      .from(sales)
      .where(eq(sales.customerId, customerId));

    return NextResponse.json({
      ...customer,
      history,
      totalSpent: Number(totals?.spent ?? 0),
      visits: totals?.visits ?? 0,
    });
  } catch (error) {
    console.error("Failed to fetch customer:", error);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const [updated] = await db
      .update(customers)
      .set({
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        notes: body.notes || null,
      })
      .where(eq(customers.id, Number(id)))
      .returning();
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}
