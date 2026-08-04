import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, inventoryLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureOperator } from "@/lib/operator";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = await ensureOperator(user);

    const body = await req.json();
    const { productId, movementType, quantity, newStock: targetStock, reference, notes } = body;

    const pid = Number(productId);
    if (!pid || !["out", "adjustment"].includes(movementType)) {
      return NextResponse.json(
        { error: "A valid product and movement type ('out' or 'adjustment') are required." },
        { status: 400 }
      );
    }

    const [existing] = await db.select().from(products).where(eq(products.id, pid));
    if (!existing) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    let finalNewStock = existing.stock;
    let loggedQty = Math.abs(Number(quantity || 0));

    if (movementType === "out") {
      finalNewStock = Math.max(0, existing.stock - loggedQty);
    } else if (movementType === "adjustment") {
      if (targetStock !== undefined && targetStock !== null && targetStock !== "") {
        finalNewStock = Math.max(0, Number(targetStock));
        loggedQty = Math.abs(finalNewStock - existing.stock);
      } else {
        finalNewStock = Math.max(0, existing.stock + Number(quantity || 0));
        loggedQty = Math.abs(finalNewStock - existing.stock);
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({
          stock: finalNewStock,
          updatedAt: new Date(),
        })
        .where(eq(products.id, pid));

      await tx.insert(inventoryLogs).values({
        productId: pid,
        movementType: movementType as "out" | "adjustment",
        quantity: loggedQty,
        previousStock: existing.stock,
        newStock: finalNewStock,
        reference: reference || (movementType === "out" ? "Wastage / Stock Out" : "Stock Adjustment"),
        notes: notes || null,
        userId,
      });
    });

    return NextResponse.json({
      success: true,
      productId: pid,
      previousStock: existing.stock,
      newStock: finalNewStock,
    });
  } catch (error: any) {
    console.error("INVENTORY ADJUST ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to adjust inventory." },
      { status: 500 }
    );
  }
}
