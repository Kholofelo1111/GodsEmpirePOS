import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const search = sp.get("search")?.trim();
    const categoryId = sp.get("categoryId");
    const barcode = sp.get("barcode")?.trim();

    const filters = [eq(products.isActive, true)];

    if (barcode) {
      filters.push(eq(products.barcode, barcode));
    }
    if (search) {
      const term = `%${search}%`;
      const match = or(ilike(products.name, term), ilike(products.barcode, term));
      if (match) filters.push(match);
    }
    if (categoryId) {
      filters.push(eq(products.categoryId, Number(categoryId)));
    }

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        barcode: products.barcode,
        categoryId: products.categoryId,
        categoryName: categories.name,
        imageUrl: products.imageUrl,
        costPrice: products.costPrice,
        sellingPrice: products.sellingPrice,
        stock: products.stock,
        minStockLevel: products.minStockLevel,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...filters))
      .orderBy(asc(products.name));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, barcode, categoryId, imageUrl, costPrice, sellingPrice, stock, minStockLevel } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }
    if (sellingPrice === undefined || sellingPrice === "" || Number(sellingPrice) < 0) {
      return NextResponse.json({ error: "A valid selling price is required" }, { status: 400 });
    }

    if (barcode?.trim()) {
      const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.barcode, barcode.trim()));
      if (existing) {
        return NextResponse.json({ error: "A product with this barcode already exists" }, { status: 409 });
      }
    }

    const [product] = await db
      .insert(products)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        barcode: barcode?.trim() || null,
        categoryId: categoryId ? Number(categoryId) : null,
        imageUrl: imageUrl?.trim() || null,
        costPrice: Number(costPrice || 0).toFixed(2),
        sellingPrice: Number(sellingPrice).toFixed(2),
        stock: Number(stock || 0),
        minStockLevel: Number(minStockLevel || 5),
      })
      .returning();

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
