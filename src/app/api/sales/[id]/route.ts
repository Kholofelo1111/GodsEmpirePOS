import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sales, saleItems, products, users, customers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const saleId = Number(id);

    const [sale] = await db
      .select({
        id: sales.id,
        receiptNumber: sales.receiptNumber,
        subtotal: sales.subtotal,
        discount: sales.discount,
        vatAmount: sales.vatAmount,
        total: sales.total,
        paymentMethod: sales.paymentMethod,
        amountTendered: sales.amountTendered,
        changeGiven: sales.changeGiven,
        createdAt: sales.createdAt,
        cashier: users.fullName,
        customerName: customers.name,
      })
      .from(sales)
      .leftJoin(users, eq(sales.userId, users.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(eq(sales.id, saleId));

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const items = await db
      .select({
        id: saleItems.id,
        name: products.name,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        totalPrice: saleItems.totalPrice,
      })
      .from(saleItems)
      .leftJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, saleId));

    return NextResponse.json({ ...sale, items });
  } catch (error) {
    console.error("Failed to fetch sale:", error);
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 });
  }
}
