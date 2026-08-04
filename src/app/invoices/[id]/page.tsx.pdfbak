"use client";

import { useEffect, useState, useRef } from "react";
import jsPDF from "jspdf";

export default function InvoiceDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [invoice, setInvoice] = useState<any>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);


  async function downloadPDF() {
    if (!invoice) return;

    const pdf = new jsPDF("p", "mm", "a4");

    let y = 20;

    pdf.setFontSize(22);
    pdf.text("God's Empire POS", 20, y);

    y += 10;
    pdf.setFontSize(12);
    pdf.text("Professional Tax Invoice", 20, y);

    y += 15;
    pdf.text(`Invoice: ${invoice.invoiceNumber}`, 20, y);

    y += 8;
    pdf.text(`Status: ${invoice.status}`, 20, y);

    y += 8;
    pdf.text(`Customer: ${invoice.customerId ?? "Walk-in Customer"}`, 20, y);

    y += 15;
    pdf.line(20, y, 190, y);

    y += 10;
    pdf.text(`Subtotal: R${Number(invoice.subtotal).toFixed(2)}`, 20, y);

    y += 8;
    pdf.text(`VAT: R${Number(invoice.tax).toFixed(2)}`, 20, y);

    y += 8;
    pdf.text(`Discount: R${Number(invoice.discount).toFixed(2)}`, 20, y);

    y += 12;
    pdf.setFontSize(16);
    pdf.text(`TOTAL: R${Number(invoice.total).toFixed(2)}`, 20, y);

    y += 20;
    pdf.setFontSize(10);
    pdf.text("Thank you for your business!", 20, y);

    pdf.save(`${invoice.invoiceNumber}.pdf`);
  }


  useEffect(() => {
    (async () => {
      const { id } = await params;
      const res = await fetch(`/api/invoices/${id}`);
      const data = await res.json();
      setInvoice(data);
    })();
  }, [params]);

  if (!invoice) {
    return <main className="p-6">Loading invoice...</main>;
  }

  return (
    <main ref={invoiceRef} className="max-w-5xl mx-auto p-8">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 shadow-lg">

        <div className="flex items-center justify-between border-b border-zinc-800 p-8">
          <div>
            <h1 className="text-3xl font-bold">God's Empire POS</h1>
            <p className="text-zinc-400">Professional Tax Invoice</p>
          </div>

          <div className="text-right">
            <div className="text-sm text-zinc-400">Invoice Number</div>
            <div className="font-bold">{invoice.invoiceNumber}</div>

            <div className="mt-3 text-sm text-zinc-400">
              Invoice Date
            </div>

            <div>
              {new Date(invoice.createdAt).toLocaleDateString()}
            </div>

            <div className="mt-3 inline-flex rounded-full bg-blue-600/20 px-3 py-1 text-sm text-blue-400 capitalize">
              {invoice.status}
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-8 md:grid-cols-2">
          <div>
            <h2 className="mb-2 font-semibold">Customer</h2>
            <p className="text-zinc-400">
              {invoice.customerName}
            </p>

            {invoice.customerPhone && (
              <p className="text-zinc-400">
                Phone: {invoice.customerPhone}
              </p>
            )}

            {invoice.customerAddress && (
              <p className="text-zinc-400">
                Address: {invoice.customerAddress}
              </p>
            )}
          </div>

          <div className="text-right">
            <h2 className="mb-2 font-semibold">Invoice Summary</h2>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>R{Number(invoice.subtotal).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>VAT</span>
                <span>R{Number(invoice.tax).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Discount</span>
                <span>R{Number(invoice.discount).toFixed(2)}</span>
              </div>

              <div className="mt-4 flex justify-between border-t border-zinc-700 pt-4 text-2xl font-bold">
                <span>Total</span>
                <span>R{Number(invoice.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>


        <div className="px-8 pb-8">
          <h2 className="mb-4 text-xl font-semibold">Invoice Items</h2>

          <table className="w-full border border-zinc-800">
            <thead className="bg-zinc-900">
              <tr>
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-center">Qty</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>

            <tbody>
              {invoice.items?.map((item:any) => (
                <tr key={item.id} className="border-t border-zinc-800">
                  <td className="p-3">
                    {item.productName ?? "Unknown Product"}
                  </td>

                  <td className="p-3 text-center">
                    {item.quantity}
                  </td>

                  <td className="p-3 text-right">
                    R{Number(item.unitPrice).toFixed(2)}
                  </td>

                  <td className="p-3 text-right font-semibold">
                    R{Number(item.totalPrice).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>


        {invoice.notes && (
          <div className="px-8 pb-8">
            <h2 className="mb-2 text-lg font-semibold">Notes</h2>
            <div className="rounded-lg border border-zinc-800 p-4 text-zinc-400">
              {invoice.notes}
            </div>
          </div>
        )}


        <div className="border-t border-zinc-800 px-8 py-6 text-center text-sm text-zinc-500">
          <p className="font-medium">
            Thank you for shopping with God's Empire POS.
          </p>

          <p className="mt-2">
            Please keep this invoice as proof of purchase.
          </p>
        </div>

        <div className="border-t border-zinc-800 p-8 flex justify-end gap-3">
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-zinc-700 px-5 py-3"
          >
            Print Invoice
          </button>

          <button
            onClick={downloadPDF}
            className="rounded-lg bg-black px-5 py-3 text-white"
          >
            Download PDF
          </button>
        </div>

      </div>
    </main>
  );

}
