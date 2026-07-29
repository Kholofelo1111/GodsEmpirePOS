import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sales, saleItems, salePayments, products, inventoryLogs, customers, notifications } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureOperator } from "@/lib/operator";

class InsufficientStockError extends Error {
  shortages: string[];
  constructor(shortages: string[]) {
    super("Insufficient stock");
    this.shortages = shortages;
  }
}

class InvalidPaymentError extends Error {}

type PaymentComponent = "cash" | "card" | "eft" | "voucher";
interface PaymentLeg {
  method: PaymentComponent;
  amount: number;
}

const VALID_COMPONENTS: PaymentComponent[] = ["cash", "card", "eft", "voucher"];

/** Resolves the request's payment info into a validated list of legs plus the overall sale-level method. */
function resolvePayments(body: any, total: number): { legs: PaymentLeg[]; overallMethod: "cash" | "card" | "split" | "eft" | "voucher" } {
  const rawPayments = Array.isArray(body.payments) ? body.payments : null;

  let legs: PaymentLeg[];
  if (rawPayments && rawPayments.length > 0) {
    legs = rawPayments.map((p: any) => ({
      method: VALID_COMPONENTS.includes(p.method) ? p.method : "cash",
      amount: Number(p.amount || 0),
    }));
  } else {
    // Backward-compatible single-method payment.
    const method: PaymentComponent = body.paymentMethod === "card" ? "card" : body.paymentMethod === "eft" ? "eft" : body.paymentMethod === "voucher" ? "voucher" : "cash";
    legs = [{ method, amount: Number(total) }];
  }

  legs = legs.filter((l) => l.amount > 0);
  if (legs.length === 0) {
    throw new InvalidPaymentError("At least one payment amount is required");
  }

  const sum = legs.reduce((s, l) => s + l.amount, 0);
  // Allow a 1-cent tolerance for floating point rounding.
  if (Math.abs(sum - Number(total)) > 0.01) {
    throw new InvalidPaymentError(
      `Payments (${sum.toFixed(2)}) must add up to the total (${Number(total).toFixed(2)})`
    );
  }

  const distinctMethods = new Set(legs.map((l) => l.method));
  const overallMethod =
    legs.length > 1 || distinctMethods.size > 1
      ? "split"
      : (legs[0].method as "cash" | "card" | "eft" | "voucher");

  return { legs, overallMethod };
}

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
      amountTendered,
      changeGiven = 0,
      customerId = null,
    } = body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items in sale" }, { status: 400 });
    }

    let legs: PaymentLeg[];
    let overallMethod: "cash" | "card" | "split" | "eft" | "voucher";
    try {
      ({ legs, overallMethod } = resolvePayments(body, total));
    } catch (err) {
      if (err instanceof InvalidPaymentError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    // Merge duplicate lines for the same product so stock is checked once
    // per product, not per line.
    const quantityByProduct = new Map<number, number>();
    for (const item of items) {
      const pid = Number(item.productId);
      quantityByProduct.set(pid, (quantityByProduct.get(pid) ?? 0) + Number(item.quantity || 0));
    }

    const subtotal = items.reduce(
      (sum: number, item: { totalPrice: number }) => sum + Number(item.totalPrice || 0),
      0
    );

    const receiptNumber = `GE-${Date.now().toString().slice(-8)}`;

    const sale = await db.transaction(async (tx) => {
      // Validate stock availability up front, inside the transaction, so
      // no sale is ever recorded if any item would oversell.
      const productRows = await tx
        .select()
        .from(products)
        .where(inArray(products.id, Array.from(quantityByProduct.keys())));

      const productsById = new Map(productRows.map((p) => [p.id, p]));
      const shortages: string[] = [];
      for (const [productId, qty] of quantityByProduct) {
        const product = productsById.get(productId);
        if (!product) {
          shortages.push(`Product #${productId} not found`);
        } else if (product.stock < qty) {
          shortages.push(`${product.name}: only ${product.stock} in stock, ${qty} requested`);
        }
      }
      if (shortages.length > 0) {
        throw new InsufficientStockError(shortages);
      }

      // Feature 5: every sale is attributed to a real customer record, so
      // dashboard visit stats always have something to count. Anonymous
      // sales are attributed to a single shared "Walk-in Customer" record.
      let resolvedCustomerId: number = customerId || 0;
      if (!resolvedCustomerId) {
        const [walkIn] = await tx.select().from(customers).where(eq(customers.isWalkIn, true)).limit(1);
        if (walkIn) {
          resolvedCustomerId = walkIn.id;
        } else {
          const [created] = await tx
            .insert(customers)
            .values({ name: "Walk-in Customer", isWalkIn: true })
            .returning({ id: customers.id });
          resolvedCustomerId = created.id;
        }
      }

      const cashLeg = legs.find((l) => l.method === "cash");
      const [createdSale] = await tx
        .insert(sales)
        .values({
          receiptNumber,
          userId,
          customerId: resolvedCustomerId,
          subtotal: subtotal.toFixed(2),
          discount: Number(discount).toFixed(2),
          vatAmount: Number(vatAmount).toFixed(2),
          total: Number(total).toFixed(2),
          paymentMethod: overallMethod,
          amountTendered: Number(amountTendered ?? cashLeg?.amount ?? total).toFixed(2),
          changeGiven: Number(changeGiven).toFixed(2),
        })
        .returning();

      for (const leg of legs) {
        await tx.insert(salePayments).values({
          saleId: createdSale.id,
          method: leg.method,
          amount: leg.amount.toFixed(2),
        });
      }

      for (const item of items) {
        await tx.insert(saleItems).values({
          saleId: createdSale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice).toFixed(2),
          totalPrice: Number(item.totalPrice).toFixed(2),
        });
      }

      for (const [productId, qty] of quantityByProduct) {
        const product = productsById.get(productId)!;
        const newStock = product.stock - qty;
        await tx.update(products).set({ stock: newStock, updatedAt: new Date() }).where(eq(products.id, productId));

        await tx.insert(inventoryLogs).values({
          productId,
          movementType: "out",
          quantity: qty,
          previousStock: product.stock,
          newStock,
          reference: receiptNumber,
          userId,
        });

        if (newStock <= product.minStockLevel) {
          const existing = await tx
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
            await tx.insert(notifications).values({
              type: "low_stock",
              title: "Low Stock Alert",
              message: `${product.name} has only ${newStock} item(s) remaining.`,
            });
          }
        }
      }

      // Feature 5: track the visit + loyalty points on whichever customer
      // record this sale was attributed to above.
      const points = Math.floor(Number(total) / 10);
      await tx
        .update(customers)
        .set({
          visitCount: sql`${customers.visitCount} + 1`,
          lastVisitAt: new Date(),
          loyaltyPoints: points > 0 ? sql`${customers.loyaltyPoints} + ${points}` : customers.loyaltyPoints,
        })
        .where(eq(customers.id, resolvedCustomerId));

      return { ...createdSale, payments: legs, cashierName: user.fullName };
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error: any) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: "Not enough stock for this sale", details: error.shortages },
        { status: 409 }
      );
    }
    console.error("SALE ERROR");
    console.error(error);
    console.error(error?.message);
    console.error(error?.stack);
    return NextResponse.json({ error: error?.message ?? "Failed to create sale" }, { status: 500 });
  }
}
