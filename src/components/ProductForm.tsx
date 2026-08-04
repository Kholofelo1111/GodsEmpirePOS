"use client";

import { useState, useEffect } from "react";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, ArrowLeft, Printer } from "lucide-react";
import { Field, inputClass, selectClass, textareaClass } from "@/components/ui/Field";
import Barcode from "@/components/Barcode";

export interface ProductFormValues {
  name: string;
  description: string;
  barcode: string;
  categoryId: string;
  imageUrl: string;
  costPrice: string;
  sellingPrice: string;
  stock: string;
  minStockLevel: string;
}

export const emptyProduct: ProductFormValues = {
  name: "",
  description: "",
  barcode: "",
  categoryId: "",
  imageUrl: "",
  costPrice: "",
  sellingPrice: "",
  stock: "0",
  minStockLevel: "5",
};

interface ProductFormProps {
  title: string;
  subtitle: string;
  initial: ProductFormValues;
  submitLabel: string;
  endpoint: string;
  method: "POST" | "PUT";
  /** When editing an existing product, enables the Print Barcode button. */
  productId?: number;
  /** When returning from an unknown barcode scan, navigate back directly after save. */
  returnPath?: string;
}

export default function ProductForm({
  title,
  subtitle,
  initial,
  submitLabel,
  endpoint,
  method,
  productId,
  returnPath,
}: ProductFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormValues>(initial);

  useEffect(() => {
    setForm(initial);
    setError("");
  }, [initial]);

  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]));
  }, []);

  const set = (patch: Partial<ProductFormValues>) => setForm((prev) => ({ ...prev, ...patch }));

  const scanBarcode = async () => {
    try {
      if (!Capacitor.isNativePlatform()) {
        window.location.href = "/scanner?return=new-product";
        return;
      }

      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        await new Promise<void>((resolve) => {
          BarcodeScanner.addListener("googleBarcodeScannerModuleInstallProgress", (event) => {
            if (event.state === 4) resolve();
          });
        });
      }

      const { barcodes } = await BarcodeScanner.scan();
      if (!barcodes.length) return;

      const code = barcodes[0].rawValue ?? "";

      set({ barcode: code });
      await Haptics.impact({ style: ImpactStyle.Medium });

      try {
        const res = await fetch(`/api/barcode-lookup?barcode=${encodeURIComponent(code)}`);
        const data = await res.json();

        if (data.found) {
          const matchedCategory = categories.find(c =>
            (data.category || "").toLowerCase().includes(c.name.toLowerCase())
          );

          set({
            barcode: code,
            name: data.name || "",
            description: `${data.brand} ${data.quantity}`.trim(),
            imageUrl: data.image || "",
            categoryId: matchedCategory ? String(matchedCategory.id) : "",
          });
        }
      } catch (err) {
        console.error(err);
      }
    } catch (e) {
      console.error(e);
    }
  };


  const margin =
    Number(form.sellingPrice) > 0 && Number(form.costPrice) > 0
      ? Math.round(
          ((Number(form.sellingPrice) - Number(form.costPrice)) / Number(form.sellingPrice)) * 100
        )
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save product");
      }

      setForm(emptyProduct);
      if (returnPath) {
        router.push(returnPath);
      } else {
        router.push("/products");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product");
      setSaving(false);
    }
  };

  return (
    <div className="animate-fadeIn max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={returnPath || "/products"}
          className="p-2.5 rounded-xl bg-dark-800 text-dark-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">{title}</h1>
          <p className="text-sm text-dark-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <form onSubmit={submit} className="glass-card rounded-2xl p-5 md:p-6 space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Product name" required className="md:col-span-2">
            <input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              className={inputClass}
              placeholder="e.g. Cotton T-Shirt"
              required
            />
          </Field>

          <Field label="Description" className="md:col-span-2">
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              className={textareaClass}
              placeholder="Optional details"
            />
          </Field>

          <Field
            label="Barcode"
            hint="Scan or type a barcode — leave blank to auto-generate a unique one"
            className="md:col-span-2"
          >
            <div className="flex gap-2 items-center">
              <input
                value={form.barcode}
                onChange={(e) => set({ barcode: e.target.value })}
                className={`${inputClass} font-mono flex-1`}
                placeholder="Leave blank to auto-generate"
              />
              <button
                type="button"
                onClick={scanBarcode}
                className="px-4 py-3 rounded-xl gold-gradient text-dark-950 font-semibold flex items-center gap-2 whitespace-nowrap"
              >
                <Camera className="w-5 h-5" />
                Scan
              </button>
            </div>

            {form.barcode && (
              <div className="mt-3 flex flex-wrap items-center gap-4 bg-white rounded-xl p-3">
                <Barcode value={form.barcode} height={50} width={1.8} fontSize={13} />
              </div>
            )}
            {!form.barcode && (
              <p className="mt-2 text-xs text-dark-500">
                A unique barcode will be generated automatically when you save.
              </p>
            )}
            {productId && (
              <Link
                href={`/products/print-barcodes?ids=${productId}`}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-dark-800 text-dark-200 text-sm font-medium rounded-xl hover:bg-dark-700 transition-colors"
              >
                <Printer className="w-4 h-4" /> Print Barcode
              </Link>
            )}
          </Field>

          <Field label="Category">
            <select
              value={form.categoryId}
              onChange={(e) => set({ categoryId: e.target.value })}
              className={selectClass}
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cost price (R)">
            <input
              type="number"
              value={form.costPrice}
              onChange={(e) => set({ costPrice: e.target.value })}
              step="0.01"
              min="0"
              className={inputClass}
              placeholder="0.00"
            />
          </Field>

          <Field
            label="Selling price (R)"
            required
            hint={margin !== null ? `${margin}% gross margin` : undefined}
          >
            <input
              type="number"
              value={form.sellingPrice}
              onChange={(e) => set({ sellingPrice: e.target.value })}
              step="0.01"
              min="0"
              className={inputClass}
              placeholder="0.00"
              required
            />
          </Field>

          <Field label="Current stock">
            <input
              type="number"
              value={form.stock}
              onChange={(e) => set({ stock: e.target.value })}
              min="0"
              className={inputClass}
            />
          </Field>

          <Field label="Minimum stock level" hint="Triggers low-stock alerts">
            <input
              type="number"
              value={form.minStockLevel}
              onChange={(e) => set({ minStockLevel: e.target.value })}
              min="0"
              className={inputClass}
            />
          </Field>

          <Field label="Image URL" className="md:col-span-2">
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => set({ imageUrl: e.target.value })}
              className={inputClass}
              placeholder="https://..."
            />
          </Field>

          {form.imageUrl && (
            <div className="md:col-span-2">
              <img
                src={form.imageUrl}
                alt={form.name || "Product"}
                className="h-40 w-40 rounded-xl border border-dark-700 object-contain bg-white p-2"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <Link
            href="/products"
            className="px-6 py-3 bg-dark-800 text-dark-300 font-medium rounded-xl hover:bg-dark-700 transition-colors text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
