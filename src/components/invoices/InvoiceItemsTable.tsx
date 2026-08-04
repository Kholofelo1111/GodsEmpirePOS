"use client";

import { useState } from "react";
import ProductPicker, { Product } from "./ProductPicker";
import {
  InvoiceItem,
  InvoiceItemsTableProps,
} from "@/types/invoice";

export default function InvoiceItemsTable({
  items,
  setItems,
  discount,
  setDiscount,
  vatEnabled,
  setVatEnabled,
}: InvoiceItemsTableProps) {
  const [showPicker, setShowPicker] = useState(false);

  function addProduct(product: Product) {
    const existing = items.find((i) => i.id === product.id);

    if (existing) {
      setItems(
        items.map((i) =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          ...product,
          quantity: 1,
        },
      ]);
    }

    setShowPicker(false);
  }


  function increaseQuantity(id: number) {
    setItems(items.map((item) =>
      item.id === id
        ? { ...item, quantity: item.quantity + 1 }
        : item
    ));
  }

  function decreaseQuantity(id: number) {
    setItems(
      items
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.sellingPrice) * item.quantity,
    0
  );


  const vat = vatEnabled ? subtotal * 0.15 : 0;

  const total = subtotal + vat - discount;

  return (
    <div className="space-y-4">

      {showPicker && (
        <ProductPicker onSelect={addProduct} />
      )}

      <div className="rounded-2xl border border-gray-700 bg-[#10131d] shadow-xl overflow-hidden">

        <div className="flex items-center justify-between border-b p-4">

          <h2 className="font-semibold text-lg">
            Invoice Items
          </h2>

          <button
            onClick={() => setShowPicker(!showPicker)}
            className="rounded-lg border px-4 py-2 hover:bg-gray-100"
          >
            {showPicker ? "Close" : "+ Add Product"}
          </button>

        </div>

        <table className="w-full">

          <thead className="bg-[#1b1d2b] border-b border-gray-700">
            <tr>
              <th className="p-3 text-left font-semibold text-gray-200">Product</th>
              <th className="p-3 text-center font-semibold text-gray-200">Qty</th>
              <th className="p-3 text-right font-semibold text-gray-200">Unit Price</th>
              <th className="p-3 text-right font-semibold text-gray-200">Total</th>
            </tr>
          </thead>

          <tbody>

            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-16 text-center text-gray-400"
                >
                  No products added yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t">

                  <td className="p-3">
                    {item.name}
                  </td>

                  <td className="p-3 text-center font-semibold text-gray-200">
<div className="flex items-center justify-center gap-2">
<button onClick={() => decreaseQuantity(item.id)} className="h-8 w-8 rounded bg-red-600 text-white hover:bg-red-700">-</button>
<span className="min-w-[24px] text-center">{item.quantity}</span>
<button onClick={() => increaseQuantity(item.id)} className="h-8 w-8 rounded bg-green-600 text-white hover:bg-green-700">+</button>
</div>
                  </td>

                  <td className="p-3 text-right font-semibold text-gray-200">
                    R{Number(item.sellingPrice).toFixed(2)}
                  </td>

                  <td className="p-3 text-right font-medium">
                    R{(
                      Number(item.sellingPrice) *
                      item.quantity
                    ).toFixed(2)}
                  </td>

                </tr>
              ))
            )}

          </tbody>
        </table>

        <div className="border-t border-gray-700 bg-[#151823] p-5 space-y-3">
          <div className="flex justify-between text-gray-300">
            <span>Subtotal</span>
            <span>R{subtotal.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-gray-300">
            <span className="flex items-center gap-2">
              VAT (15%)
              <input
                type="checkbox"
                checked={vatEnabled}
                onChange={(e) => setVatEnabled(e.target.checked)}
                className="h-4 w-4 accent-yellow-400 cursor-pointer"
              />
            </span>
            <span>R{vat.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center text-gray-300">
            <span>Discount</span>
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="w-28 rounded bg-[#10131d] border border-gray-600 px-2 py-1 text-right text-white focus:border-yellow-400 outline-none"
            />
          </div>
          <div className="border-t border-gray-700 pt-3 flex justify-between text-2xl font-bold text-yellow-400">
            <span>Total</span>
            <span>R{total.toFixed(2)}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
