"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, PackageX, FileDown, Layers } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Barcode from "@/components/Barcode";
import { money } from "@/lib/format";
import { Field, selectClass, inputClass } from "@/components/ui/Field";

interface Product {
  id: number;
  name: string;
  barcode: string | null;
  sellingPrice: string;
}

type LabelLayout = "a4-24" | "a4-30" | "a4-40" | "roll";

function PrintBarcodesInner() {
  const params = useSearchParams();
  const ids = params.get("ids") ?? "";
  const [products, setProducts] = useState<Product[] | null>(null);

  const [layout, setLayout] = useState<LabelLayout>("a4-24");
  const [defaultCopies, setDefaultCopies] = useState<number>(1);
  const [customCopies, setCustomCopies] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!ids) {
      setProducts([]);
      return;
    }
    fetch(`/api/products?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => setProducts([]));
  }, [ids]);

  if (products === null) return <Spinner label="Loading products..." />;

  if (products.length === 0) {
    return (
      <div className="glass-card rounded-2xl max-w-lg mx-auto">
        <EmptyState
          icon={<PackageX className="w-6 h-6 text-dark-500" />}
          title="No products to print"
          message="Select one or more products from the catalogue first."
        />
      </div>
    );
  }

  const getCopyCount = (id: number) => customCopies[id] ?? defaultCopies;

  const setCopyCount = (id: number, count: number) => {
    setCustomCopies((prev) => ({ ...prev, [id]: Math.max(1, count) }));
  };

  const allLabels: Product[] = [];
  for (const p of products) {
    const count = getCopyCount(p.id);
    for (let i = 0; i < count; i++) {
      allLabels.push(p);
    }
  }

  const layoutClassMap: Record<LabelLayout, string> = {
    "a4-24": "grid grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-3 print:gap-3 print:w-[210mm]",
    "a4-30": "grid grid-cols-2 md:grid-cols-3 gap-2 print:grid-cols-3 print:gap-2 print:w-[210mm]",
    "a4-40": "grid grid-cols-2 md:grid-cols-4 gap-2 print:grid-cols-4 print:gap-1.5 print:w-[210mm]",
    roll: "flex flex-col gap-4 max-w-[220px] mx-auto print:max-w-[58mm] print:mx-0 print:gap-3",
  };

  return (
    <div className="animate-fadeIn space-y-5">
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="p-2.5 rounded-xl bg-dark-800 text-dark-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Print Barcodes</h1>
            <p className="text-sm text-dark-400 mt-0.5">
              {products.length} product{products.length === 1 ? "" : "s"} · {allLabels.length} label
              {allLabels.length === 1 ? "" : "s"} total
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 text-dark-200 font-semibold rounded-xl hover:bg-dark-700 transition-colors"
            title="Save as PDF using Print dialog"
          >
            <FileDown className="w-4 h-4" /> Save PDF
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-gold-500/20"
          >
            <Printer className="w-4 h-4" /> Print Labels
          </button>
        </div>
      </div>

      {/* Control panel */}
      <div className="print:hidden glass-card rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Label Size / Layout">
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as LabelLayout)}
              className={selectClass}
            >
              <option value="a4-24">A4 — 24 Labels per Sheet (3 × 8) · 70×37mm</option>
              <option value="a4-30">A4 — 30 Labels per Sheet (3 × 10) · 70×30mm</option>
              <option value="a4-40">A4 — 40 Labels per Sheet (4 × 10) · 52.5×30mm</option>
              <option value="roll">Thermal Roll — 58mm Single Label Roll</option>
            </select>
          </Field>

          <Field label="Copies per Product (Default)">
            <input
              type="number"
              min="1"
              max="100"
              value={defaultCopies}
              onChange={(e) => setDefaultCopies(Math.max(1, Number(e.target.value) || 1))}
              className={inputClass}
            />
          </Field>

          <div className="flex flex-col justify-end">
            <button
              onClick={() => {
                setDefaultCopies(1);
                setCustomCopies({});
              }}
              className="py-2.5 px-4 bg-dark-800 text-dark-300 hover:text-white rounded-xl text-sm transition-colors"
            >
              Reset Copy Counts
            </button>
          </div>
        </div>

        {/* Individual copy counts */}
        <div className="border-t border-dark-800 pt-3">
          <p className="text-xs font-semibold text-dark-400 mb-2">Adjust Copies per Product:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 p-2 bg-dark-900 rounded-lg text-xs"
              >
                <span className="text-white truncate font-medium">{p.name}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-dark-400">×</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={getCopyCount(p.id)}
                    onChange={(e) => setCopyCount(p.id, Number(e.target.value) || 1)}
                    className="w-14 px-1.5 py-1 bg-dark-800 border border-dark-700 rounded text-center text-white font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Printable Sheet */}
      <div
        id="barcode-print-sheet"
        className="glass-card print:bg-white print:border-0 rounded-2xl p-6 print:p-0 print:rounded-none"
      >
        <div className={layoutClassMap[layout]}>
          {allLabels.map((p, idx) => (
            <div
              key={`${p.id}-${idx}`}
              className="p-3 bg-dark-900/60 print:bg-white border border-dark-700 print:border print:border-black/30 rounded-xl print:rounded-none flex flex-col items-center justify-between text-center min-h-[90px] print:min-h-[35mm]"
            >
              <p className="text-xs font-bold text-white print:text-black truncate w-full">
                {p.name}
              </p>
              <div className="my-1 flex flex-col items-center">
                <Barcode value={p.barcode ?? ""} height={36} width={1.4} fontSize={0} />
                <p className="text-[11px] font-mono font-bold text-dark-300 print:text-black tracking-wider mt-0.5">
                  {p.barcode ?? "NO-CODE"}
                </p>
              </div>
              <p className="text-xs font-bold text-gold-400 print:text-black">
                {money(p.sellingPrice)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PrintBarcodesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PrintBarcodesInner />
    </Suspense>
  );
}
