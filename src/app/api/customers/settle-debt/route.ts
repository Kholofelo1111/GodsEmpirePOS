import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, customerDebtSettlements, sales } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureOperator } from "@/lib/operator";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { error: "Unauthorized: login required" },
        { status: 401 }
      );
    }

    const userId = await ensureOperator(user);

    const body = await req.json();
    const { customerId, amount, paymentMethod = "cash", notes } = body;

    const cid = Number(customerId);
    const amt = Number(amount);

    if (!cid || !Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json(
        { error: "A valid customer and positive settlement amount are required." },
        { status: 400 }
      );
    }

    const [customer] = await db.select().from(customers).where(eq(customers.id, cid));
    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    const currentDebt = Number(customer.outstandingBalance || 0);
    const newDebt = Math.max(0, currentDebt - amt);

    await db.transaction(async (tx) => {
      await tx.insert(customerDebtSettlements).values({
        customerId: cid,
        amount: amt.toFixed(2),
        paymentMethod: paymentMethod as any,
        notes: notes || null,
        userId,
      });

      await tx
        .update(customers)
        .set({
          outstandingBalance: newDebt.toFixed(2),
        })
        .where(eq(customers.id, cid));

      // If debt is fully settled, mark pending sales as paid
      if (newDebt <= 0) {
        await tx
          .update(sales)
          .set({ paymentStatus: "paid", outstandingBalance: "0.00" })
          .where(eq(sales.customerId, cid));
      }
    });

    return NextResponse.json({
      success: true,
      customerId: cid,
      previousBalance: currentDebt,
      amountSettled: amt,
      newBalance: newDebt,
    });
  } catch (error: any) {
    console.error("DEBT SETTLEMENT ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to settle customer balance." },
      { status: 500 }
    );
  }
}
