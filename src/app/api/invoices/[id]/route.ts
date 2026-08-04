import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, invoiceItems, products, customers } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, Number(id)),
    });

    const customer = invoice?.customerId
      ? await db.query.customers.findFirst({
          where: eq(customers.id, invoice.customerId),
        })
      : null;

    const items = await db
      .select({
        id: invoiceItems.id,
        quantity: invoiceItems.quantity,
        unitPrice: invoiceItems.unitPrice,
        totalPrice: invoiceItems.totalPrice,
        productName: products.name,
      })
      .from(invoiceItems)
      .leftJoin(products, eq(invoiceItems.productId, products.id))
      .where(eq(invoiceItems.invoiceId, Number(id)));

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...invoice,
      customerName: customer?.name ?? "Walk-in Customer",
      customerPhone: customer?.phone ?? "",
      customerAddress: customer?.address ?? "",
      items,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load invoice" },
      { status: 500 }
    );
  }
}
