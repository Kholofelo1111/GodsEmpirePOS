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

  const pdf = new jsPDF("p","mm","a4");

  const logo = new Image();
  logo.src="/images/logo.png";

  await new Promise(resolve=>{
    logo.onload=resolve;
    logo.onerror=resolve;
  });

  let y=18;

  pdf.setFillColor(20,20,20);
  pdf.rect(0,0,210,28,"F");

  try{
    pdf.addImage(logo,"PNG",10,4,18,18);
  }catch{}

  pdf.setTextColor(212,175,55);
  pdf.setFont("helvetica","bold");
  pdf.setFontSize(20);
  pdf.text("GOD'S EMPIRE POS",105,12,{align:"center"});

  pdf.setTextColor(255,255,255);
  pdf.setFontSize(10);
  pdf.text("TAX INVOICE",105,20,{align:"center"});

  pdf.setTextColor(0,0,0);
  pdf.setFontSize(11);

  y=38;

  pdf.text("Invoice",20,y);
  pdf.text(invoice.invoiceNumber,60,y);

  pdf.text("Date",120,y);
  pdf.text(new Date(invoice.createdAt).toLocaleDateString("en-ZA"),150,y);

  y+=8;

  pdf.text("Customer",20,y);
  pdf.text(invoice.customerName || "Walk-in Customer",60,y);

  pdf.text("Status",120,y);
  pdf.text(String(invoice.status).toUpperCase(),150,y);

  y+=8;
  pdf.line(15,y,195,y);

  y+=10;

  pdf.setFont("helvetica","bold");
  pdf.text("#",20,y);
  pdf.text("Product",30,y);
  pdf.text("Qty",130,y);
  pdf.text("Price",150,y);
  pdf.text("Total",175,y);

  y+=5;
  pdf.line(15,y,195,y);

  pdf.setFont("helvetica","normal");

  (invoice.items||[]).forEach((item:any,index:number)=>{
    y+=7;
    pdf.text(String(index+1),20,y);
    pdf.text((item.productName||"Unknown").substring(0,28),30,y);
    pdf.text(String(item.quantity),132,y);
    pdf.text(`R${Number(item.unitPrice).toFixed(2)}`,150,y);
    pdf.text(`R${Number(item.totalPrice).toFixed(2)}`,175,y);

    if(y>260){
      pdf.addPage();
      y=20;
    }
  });

  y+=12;
  pdf.line(120,y,195,y);

  y+=8;
  pdf.text("Subtotal",125,y);
  pdf.text(`R${Number(invoice.subtotal).toFixed(2)}`,175,y);

  y+=8;
  pdf.text("VAT",125,y);
  pdf.text(`R${Number(invoice.tax).toFixed(2)}`,175,y);

  y+=8;
  pdf.text("Discount",125,y);
  pdf.text(`R${Number(invoice.discount).toFixed(2)}`,175,y);

  y+=10;
  pdf.setFont("helvetica","bold");
  pdf.setFontSize(14);
  pdf.text("TOTAL",125,y);
  pdf.text(`R${Number(invoice.total).toFixed(2)}`,175,y);

  y+=18;
  pdf.setFontSize(10);
  pdf.setFont("helvetica","normal");
  pdf.text("Thank you for shopping with God's Empire POS.",20,y);

  y+=6;
  pdf.text("Generated: "+new Date().toLocaleString("en-ZA"),20,y);

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
