import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, inventoryLogs } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { getCurrentUser, canDeleteProducts, sanitizeProductForRole } from "@/lib/auth";
import { ensureOperator } from "@/lib/operator";
import { generateUniqueBarcode } from "@/lib/barcode";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [product] = await db.select().from(products).where(eq(products.id, Number(id)));
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const user = await getCurrentUser();
    const sanitizedProduct = sanitizeProductForRole(product, user.role);
    return NextResponse.json(sanitizedProduct);
  } catch {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const productId = Number(id);
    const body = await req.json();

    const [existing] = await db.select().from(products).where(eq(products.id, productId));
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const newStock = body.stock !== undefined ? Number(body.stock) : existing.stock;

    const requestedBarcode: string | undefined = body.barcode?.trim();
    let finalBarcode: string;
    if (requestedBarcode) {
      if (requestedBarcode !== existing.barcode) {
        const [dupe] = await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.barcode, requestedBarcode), ne(products.id, productId)));
        if (dupe) {
          return NextResponse.json({ error: "A product with this barcode already exists" }, { status: 409 });
        }
      }
      finalBarcode = requestedBarcode;
    } else {
      // Barcode field was cleared — generate a new unique one rather than
      // leaving the product without a scannable code.
      finalBarcode = await generateUniqueBarcode(async (code) => {
        const [dupe] = await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.barcode, code), ne(products.id, productId)));
        return Boolean(dupe);
      });
    }

    const [product] = await db
      .update(products)
      .set({
        name: body.name?.trim() ?? existing.name,
        description: body.description?.trim() || null,
        barcode: finalBarcode,
        categoryId: body.categoryId ? Number(body.categoryId) : null,
        imageUrl: body.imageUrl?.trim() || null,
        costPrice: Number(body.costPrice ?? existing.costPrice).toFixed(2),
        sellingPrice: Number(body.sellingPrice ?? existing.sellingPrice).toFixed(2),
        stock: newStock,
        minStockLevel: Number(body.minStockLevel ?? existing.minStockLevel),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();

    // Record a manual adjustment when stock is edited directly.
    if (newStock !== existing.stock) {
      const user = await getCurrentUser();
      const userId = await ensureOperator(user);
      await db.insert(inventoryLogs).values({
        productId,
        movementType: "adjustment",
        quantity: Math.abs(newStock - existing.stock),
        previousStock: existing.stock,
        newStock,
        reference: "MANUAL-EDIT",
        notes: "Stock adjusted from product editor",
        userId,
      });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!canDeleteProducts(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only Store Owner / Administrator can delete products." },
        { status: 403 }
      );
    }
    const { id } = await params;
    await db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(products.id, Number(id)));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
