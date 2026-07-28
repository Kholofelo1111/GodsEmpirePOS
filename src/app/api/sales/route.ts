import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sales, saleItems, products, inventoryLogs, customers, notifications } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureOperator } from "@/lib/operator";

export async function GET() {
  try {
    const allSales = await db.select().from(sales).orderBy(desc(sales.createdAt)).limit(200);
    return NextResponse.json(allSales);
  } catch (error) {
    console.error("Failed to fetch sales:", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = await ensureOperator(user);

    const body = await req.json();
    const {
      items,
      discount = 0,
      vatAmount = 0,
      total = 0,
      paymentMethod = "cash",
      amountTendered,
      changeGiven = 0,
      customerId = null,
    } = body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items in sale" }, { status: 400 });
    }

    const subtotal = items.reduce(
      (sum: number, item: { totalPrice: number }) => sum + Number(item.totalPrice || 0),
      0
    );

    const receiptNumber = `GE-${Date.now().toString().slice(-8)}`;

    const [sale] = await db
      .insert(sales)
      .values({
        receiptNumber,
        userId,
        customerId: customerId || null,
        subtotal: subtotal.toFixed(2),
        discount: Number(discount).toFixed(2),
        vatAmount: Number(vatAmount).toFixed(2),
        total: Number(total).toFixed(2),
        paymentMethod: paymentMethod === "card" ? "card" : "cash",
        amountTendered: Number(amountTendered ?? total).toFixed(2),
        changeGiven: Number(changeGiven).toFixed(2),
      })
      .returning();

    for (const item of items) {
      await db.insert(saleItems).values({
        saleId: sale.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice).toFixed(2),
        totalPrice: Number(item.totalPrice).toFixed(2),
      });

      const [product] = await db.select().from(products).where(eq(products.id, item.productId));
      if (product) {
        const newStock = product.stock - item.quantity;
        await db.update(products).set({ stock: newStock, updatedAt: new Date() }).where(eq(products.id, item.productId));

        await db.insert(inventoryLogs).values({
          productId: item.productId,
          movementType: "out",
          quantity: item.quantity,
          previousStock: product.stock,
          newStock,
          reference: receiptNumber,
          userId,
        });

        if (newStock <= product.minStockLevel) {
          const existing = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.type, "low_stock"),
                eq(notifications.isRead, false),
                eq(
                  notifications.message,
                  `${product.name} has only ${newStock} item(s) remaining.`
                )
              )
            );

          if (existing.length === 0) {
            await db.insert(notifications).values({
              type: "low_stock",
              title: "Low Stock Alert",
              message: `${product.name} has only ${newStock} item(s) remaining.`,
            });
          }
        }
      }
    }

    if (customerId) {
      const points = Math.floor(Number(total) / 10);
      if (points > 0) {
        await db
          .update(customers)
          .set({ loyaltyPoints: sql`${customers.loyaltyPoints} + ${points}` })
          .where(eq(customers.id, customerId));
      }
    }

    return NextResponse.json(sale, { status: 201 });
  } catch (error: any) {
    console.error("SALE ERROR");
    console.error(error);
    console.error(error?.message);
    console.error(error?.stack);
    return NextResponse.json({ error: error?.message ?? "Failed to create sale" }, { status: 500 });
  }
}
