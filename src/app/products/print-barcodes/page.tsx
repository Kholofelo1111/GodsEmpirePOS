"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, PackageX } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Barcode from "@/components/Barcode";
import { money } from "@/lib/format";

interface Product {
  id: number;
  name: string;
  barcode: string | null;
  sellingPrice: string;
}

function PrintBarcodesInner() {
  const params = useSearchParams();
  const ids = params.get("ids") ?? "";
  const [products, setProducts] = useState<Product[] | null>(null);

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

  return (
    <div className="animate-fadeIn space-y-5">
      <div className="print:hidden flex items-center justify-between gap-3">
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
              {products.length} label{products.length === 1 ? "" : "s"} ready
            </p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          <Printer className="w-5 h-5" /> Print
        </button>
      </div>

      <div id="barcode-print-sheet" className="glass-card print:bg-white print:border-0 rounded-2xl p-4 print:p-0 print:rounded-none">
        <div className="barcode-label-grid">
          {products.map((p) => (
            <div key={p.id} className="barcode-label">
              <p className="barcode-label-name">{p.name}</p>
              <Barcode value={p.barcode ?? ""} height={45} width={1.6} fontSize={12} />
              <p className="barcode-label-price">{money(p.sellingPrice)}</p>
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
