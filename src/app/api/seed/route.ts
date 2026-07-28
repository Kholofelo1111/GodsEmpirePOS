import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories, products, settings, suppliers } from "@/db/schema";
import { sql } from "drizzle-orm";
import { ensureOperator } from "@/lib/operator";
import { DEFAULT_USER } from "@/lib/auth";

/**
 * Seeds demo catalogue data. Authentication is disabled, so no user accounts
 * or passwords are created here beyond the default operator record.
 */
export async function POST() {
  try {
    await ensureOperator(DEFAULT_USER);

    const defaultCategories = [
      { name: "General", description: "General products" },
      { name: "Electronics", description: "Electronic devices and accessories" },
      { name: "Clothing", description: "Apparel and fashion items" },
      { name: "Food & Beverages", description: "Consumable items" },
      { name: "Health & Beauty", description: "Health and beauty products" },
    ];

    for (const cat of defaultCategories) {
      await db.insert(categories).values(cat).onConflictDoNothing({ target: categories.name });
    }

    const defaultSuppliers = [
      { name: "Jozi Wholesale", contactPerson: "Thabo Mokoena", phone: "+27 11 555 0110", email: "orders@joziwholesale.co.za" },
      { name: "Cape Distributors", contactPerson: "Ayesha Patel", phone: "+27 21 555 0142", email: "sales@capedist.co.za" },
    ];

    for (const sup of defaultSuppliers) {
      await db.insert(suppliers).values(sup).onConflictDoNothing({ target: suppliers.name });
    }

    const sampleProducts = [
      { name: "Premium Headphones", barcode: "6001001000015", costPrice: "450.00", sellingPrice: "799.00", stock: 25, minStockLevel: 5, categoryId: 2 },
      { name: "Cotton T-Shirt", barcode: "6001001000022", costPrice: "80.00", sellingPrice: "179.00", stock: 50, minStockLevel: 10, categoryId: 3 },
      { name: "Energy Drink 500ml", barcode: "6001001000039", costPrice: "12.00", sellingPrice: "25.00", stock: 100, minStockLevel: 20, categoryId: 4 },
      { name: "Face Moisturizer", barcode: "6001001000046", costPrice: "65.00", sellingPrice: "149.00", stock: 30, minStockLevel: 8, categoryId: 5 },
      { name: "USB-C Cable 2m", barcode: "6001001000053", costPrice: "35.00", sellingPrice: "89.00", stock: 75, minStockLevel: 15, categoryId: 2 },
      { name: "Wireless Mouse", barcode: "6001001000060", costPrice: "120.00", sellingPrice: "299.00", stock: 3, minStockLevel: 5, categoryId: 2 },
      { name: "Protein Bar", barcode: "6001001000077", costPrice: "15.00", sellingPrice: "35.00", stock: 0, minStockLevel: 10, categoryId: 4 },
      { name: "Sunglasses Classic", barcode: "6001001000084", costPrice: "150.00", sellingPrice: "399.00", stock: 15, minStockLevel: 5, categoryId: 3 },
      { name: "Maize Meal 2.5kg", barcode: "6001001000091", costPrice: "28.00", sellingPrice: "49.00", stock: 60, minStockLevel: 12, categoryId: 4 },
      { name: "Power Bank 10000mAh", barcode: "6001001000107", costPrice: "210.00", sellingPrice: "429.00", stock: 12, minStockLevel: 4, categoryId: 2 },
    ];

    for (const prod of sampleProducts) {
      await db.insert(products).values(prod).onConflictDoNothing({ target: products.barcode });
    }

    const businessInfo = {
      name: "God's Empire",
      address: "123 Main Street, Johannesburg, 2001",
      phone: "+27 11 123 4567",
      email: "info@godsempire.co.za",
      currency: "ZAR",
      vatRate: 15,
      receiptFooter: "Thank you for shopping at God's Empire!",
    };

    await db
      .insert(settings)
      .values({ key: "business_info", value: businessInfo })
      .onConflictDoUpdate({ target: settings.key, set: { value: businessInfo, updatedAt: new Date() } });

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(products);

    return NextResponse.json({ success: true, message: "Demo data seeded", productCount: count });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Failed to seed database" }, { status: 500 });
  }
}
