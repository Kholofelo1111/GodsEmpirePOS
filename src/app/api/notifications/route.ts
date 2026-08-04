import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications, sales, products, customers } from "@/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";

export async function GET() {
  try {
    const sinceToday = new Date();
    sinceToday.setHours(0, 0, 0, 0);

    // 1. Daily summary check
    const [todaySales] = await db
      .select({
        revenue: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(sales)
      .where(gte(sales.createdAt, sinceToday));

    if (todaySales && todaySales.count > 0) {
      const summaryMsg = `Today: ${todaySales.count} transactions totaling R ${Number(
        todaySales.revenue
      ).toFixed(2)}.`;
      const existingSummary = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.type, "daily_summary"),
            eq(notifications.message, summaryMsg)
          )
        );

      if (existingSummary.length === 0) {
        await db.insert(notifications).values({
          type: "daily_summary",
          title: "Daily Sales Summary",
          message: summaryMsg,
          isRead: false,
        });
      }
    }

    // 2. Out of stock alert check
    const outOfStockProducts = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.isActive, true), sql`${products.stock} <= 0`))
      .limit(5);

    for (const p of outOfStockProducts) {
      const msg = `${p.name} is completely out of stock.`;
      const existing = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.type, "out_of_stock"),
            eq(notifications.isRead, false),
            eq(notifications.message, msg)
          )
        );
      if (existing.length === 0) {
        await db.insert(notifications).values({
          type: "out_of_stock",
          title: "Out of Stock Alert",
          message: msg,
          isRead: false,
        });
      }
    }

    // 3. Outstanding balance check
    const [debtSummary] = await db
      .select({
        totalDebt: sql<string>`COALESCE(SUM(${customers.outstandingBalance}), 0)`,
        count: sql<number>`COUNT(*) FILTER (WHERE ${customers.outstandingBalance} > 0)::int`,
      })
      .from(customers);

    if (debtSummary && Number(debtSummary.totalDebt) > 0) {
      const debtMsg = `${debtSummary.count} customer account(s) have unpaid balances totaling R ${Number(
        debtSummary.totalDebt
      ).toFixed(2)}.`;
      const existingDebt = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.type, "outstanding_balance"),
            eq(notifications.isRead, false),
            eq(notifications.message, debtMsg)
          )
        );

      if (existingDebt.length === 0) {
        await db.insert(notifications).values({
          type: "outstanding_balance",
          title: "Outstanding Balances Alert",
          message: debtMsg,
          isRead: false,
        });
      }
    }

    const data = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(60);

    return NextResponse.json(data);
  } catch (error) {
    console.error("NOTIFICATIONS FETCH ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}
