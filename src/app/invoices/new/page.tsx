"use client";

import { useState } from "react";
import InvoiceItemsTable from "@/components/invoices/InvoiceItemsTable";
import { InvoiceItem } from "@/types/invoice";

export default function NewInvoicePage() {
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [vatEnabled, setVatEnabled] = useState(true);

  async function saveInvoice(status = 'draft') {

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.sellingPrice) * item.quantity,
      0
    );

    const tax = vatEnabled ? subtotal * 0.15 : 0;

    const total = subtotal + tax - discount;

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          notes,
          items,
          subtotal,
          tax,
          discount,
          total,
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Failed to save draft.");
        return;
      }

      alert("Draft saved successfully!");
      console.log(result);
    } catch (error) {
      console.error(error);
      alert("Network error while saving draft.");
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">

      <div>
        <h1 className="text-3xl font-bold">New Invoice</h1>
        <p className="text-gray-500">
          Create a professional customer invoice.
        </p>
      </div>

      <div className="rounded-xl border p-6 space-y-5">

        <div>
          <label className="block mb-2 font-medium">
            Customer
          </label>

          <input
            className="w-full rounded-lg border p-3"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Walk-in Customer"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">
            Notes
          </label>

          <textarea
            className="w-full rounded-lg border p-3"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Invoice notes..."
          />
        </div>

      </div>

      <InvoiceItemsTable
        items={items}
        setItems={setItems}
        discount={discount}
        setDiscount={setDiscount}
        vatEnabled={vatEnabled}
        setVatEnabled={setVatEnabled}
      />

      <div className="flex justify-end gap-3">

        <button onClick={() => saveInvoice('draft')} className="rounded-lg border px-5 py-3">
          Save Draft
        </button>

        <button onClick={() => saveInvoice('sent')} className="rounded-lg bg-black px-5 py-3 text-white">
          Create Invoice
        </button>

      </div>

    </main>
  );
}
