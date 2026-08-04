import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stockIn, products, inventoryLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureOperator } from "@/lib/operator";

export async function GET() {
  try {
    const records = await db
      .select({
        id: stockIn.id,
        productId: stockIn.productId,
        productName: products.name,
        supplierId: stockIn.supplierId,
        quantity: stockIn.quantity,
        purchaseCost: stockIn.purchaseCost,
        notes: stockIn.notes,
        createdAt: stockIn.createdAt,
      })
      .from(stockIn)
      .leftJoin(products, eq(stockIn.productId, products.id))
      .orderBy(desc(stockIn.createdAt))
      .limit(50);

    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch stock records:", error);
    return NextResponse.json({ error: "Failed to fetch stock records" }, { status: 500 });
  }
}

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

    const { productId, supplierId, quantity, purchaseCost, notes } = await req.json();

    if (!productId || !quantity || Number(quantity) <= 0) {
      return NextResponse.json({ error: "Product and a positive quantity are required" }, { status: 400 });
    }

    const qty = Number(quantity);

    const [record] = await db
      .insert(stockIn)
      .values({
        productId: Number(productId),
        supplierId: supplierId ? Number(supplierId) : null,
        quantity: qty,
        purchaseCost: purchaseCost ? Number(purchaseCost).toFixed(2) : null,
        notes: notes || null,
        userId,
      })
      .returning();

    const [product] = await db.select().from(products).where(eq(products.id, Number(productId)));
    if (product) {
      const newStock = product.stock + qty;
      await db.update(products).set({ stock: newStock, updatedAt: new Date() }).where(eq(products.id, product.id));

      await db.insert(inventoryLogs).values({
        productId: product.id,
        movementType: "in",
        quantity: qty,
        previousStock: product.stock,
        newStock,
        reference: `STOCK-IN-${record.id}`,
        notes: notes || null,
        userId,
      });
    }

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Stock in error:", error);
    return NextResponse.json({ error: "Failed to record stock in" }, { status: 500 });
  }
}
