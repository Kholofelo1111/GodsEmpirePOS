import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoiceItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ensureOperator } from "@/lib/operator";

export async function GET() {
  try {
    const data = await db.select().from(invoices).orderBy(invoices.createdAt);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
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

    const body = await req.json();

    const {
      customerId = null,
      items = [],
      subtotal = 0,
      tax = 0,
      discount = 0,
      total = 0,
      status = "draft",
      notes = null,
      dueDate = null,
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invoice has no items." },
        { status: 400 }
      );
    }

    const invoiceNumber = `DRAFT-${Date.now()}`;

    const createdInvoice = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          invoiceNumber,
          customerId,
          status,
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          notes,
          dueDate: dueDate ? new Date(dueDate) : null,
          userId,
        })
        .returning();

      for (const item of items) {
        await tx.insert(invoiceItems).values({
          invoiceId: invoice.id,
          productId: item.id,
          quantity: item.quantity,
          unitPrice: Number(item.sellingPrice).toFixed(2),
          totalPrice: (Number(item.sellingPrice) * item.quantity).toFixed(2),
        });
      }

      return invoice;
    });

    return NextResponse.json({
      success: true,
      message: "Draft saved successfully.",
      invoiceId: createdInvoice.id,
      invoiceNumber: createdInvoice.invoiceNumber,
    });

  } catch (error) {
    console.error("Invoice draft error:", error);

    return NextResponse.json(
      { error: "Failed to save invoice draft." },
      { status: 500 }
    );
  }
}