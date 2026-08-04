import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sales, saleItems, products, users, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { jsPDF } from "jspdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ receiptNumber: string }> }
) {
  const { receiptNumber } = await params;

  const [sale] = await db
    .select({
      id: sales.id,
      receiptNumber: sales.receiptNumber,
      subtotal: sales.subtotal,
      discount: sales.discount,
      vatAmount: sales.vatAmount,
      total: sales.total,
      createdAt: sales.createdAt,
      cashier: users.fullName,
      customer: customers.name,
    })
    .from(sales)
    .leftJoin(users, eq(sales.userId, users.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(eq(sales.receiptNumber, receiptNumber));

  if (!sale) {
    return new NextResponse("Receipt not found", { status: 404 });
  }

  const items = await db
    .select({
      name: products.name,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      totalPrice: saleItems.totalPrice,
    })
    .from(saleItems)
    .leftJoin(products, eq(saleItems.productId, products.id))
    .where(eq(saleItems.saleId, sale.id));

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 220],
  });

  let y = 10;

  pdf.setFontSize(16);
  pdf.text("God's Empire POS", 40, y, { align: "center" });

  y += 8;
  pdf.setFontSize(9);
  pdf.text("Receipt: " + sale.receiptNumber, 5, y);

  y += 5;
  pdf.text("Cashier: " + (sale.cashier ?? "Store Operator"), 5, y);

  y += 5;
  pdf.text(new Date(sale.createdAt).toLocaleString(), 5, y);

  y += 8;
  pdf.line(5, y, 75, y);

  y += 5;

  items.forEach(item => {
    pdf.text(item.name ?? "", 5, y);
    y += 4;
    pdf.text(
      item.quantity + " x R" + Number(item.unitPrice).toFixed(2),
      5,
      y
    );
    pdf.text(
      "R" + Number(item.totalPrice).toFixed(2),
      72,
      y,
      { align: "right" }
    );
    y += 6;
  });

  pdf.line(5, y, 75, y);

  y += 6;
  pdf.text("VAT", 5, y);
  pdf.text("R" + Number(sale.vatAmount).toFixed(2), 72, y, { align: "right" });

  y += 5;
  pdf.text("Discount", 5, y);
  pdf.text("R" + Number(sale.discount).toFixed(2), 72, y, { align: "right" });

  y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.text("TOTAL", 5, y);
  pdf.text("R" + Number(sale.total).toFixed(2), 72, y, { align: "right" });

  y += 10;
  pdf.setFont("helvetica", "normal");
  pdf.text("Thank you for shopping!", 40, y, { align: "center" });

  const buffer = Buffer.from(pdf.output("arraybuffer"));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="' + sale.receiptNumber + '.pdf"',
    },
  });
}
