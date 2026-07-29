"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, Package, Printer, Barcode as BarcodeIcon } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import { money, stockStatus } from "@/lib/format";

interface Product {
  id: number;
  name: string;
  barcode: string | null;
  categoryName: string | null;
  categoryId: number | null;
  costPrice: string;
  sellingPrice: string;
  stock: number;
  minStockLevel: number;
  imageUrl: string | null;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const printBarcodes = (ids: number[]) => {
    if (ids.length === 0) return;
    router.push(`/products/print-barcodes?ids=${ids.join(",")}`);
  };

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/categories").then((r) => r.json()),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setCategories(Array.isArray(c) ? c : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCat = categoryFilter === "all" || p.categoryId === categoryFilter;
      const matchesTerm =
        !term || p.name.toLowerCase().includes(term) || (p.barcode ?? "").includes(term);
      return matchesCat && matchesTerm;
    });
  }, [products, search, categoryFilter]);

  const remove = async (id: number, name: string) => {
    if (!confirm(`Remove "${name}" from the catalogue?`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="animate-fadeIn space-y-5">
      <PageHeader
        title="Products"
        subtitle={`${products.length} active product${products.length === 1 ? "" : "s"}`}
        action={
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={() => printBarcodes(Array.from(selected))}
                className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 text-white font-semibold rounded-xl hover:bg-dark-700 transition-colors"
              >
                <Printer className="w-5 h-5" /> Print {selected.size} Barcode{selected.size === 1 ? "" : "s"}
              </button>
            )}
            <Link
              href="/products/new"
              className="flex items-center gap-2 px-4 py-2.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" /> Add Product
            </Link>
          </div>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search by name or barcode..." />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategoryFilter("all")}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            categoryFilter === "all"
              ? "gold-gradient text-dark-950"
              : "bg-dark-800 text-dark-300 hover:text-white"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryFilter(c.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              categoryFilter === c.id
                ? "gold-gradient text-dark-950"
                : "bg-dark-800 text-dark-300 hover:text-white"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading products..." />
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl">
          <EmptyState
            icon={<Package className="w-6 h-6 text-dark-500" />}
            title="No products found"
            message={search ? "Try a different search." : "Add your first product to get started."}
            action={
              <Link
                href="/products/new"
                className="inline-flex items-center gap-2 px-4 py-2 gold-gradient text-dark-950 text-sm font-semibold rounded-xl"
              >
                <Plus className="w-4 h-4" /> Add Product
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {filtered.map((p) => {
              const status = stockStatus(p.stock, p.minStockLevel);
              return (
                <div key={p.id} className="glass-card rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      className="mt-1 w-4 h-4 rounded accent-gold-500 flex-shrink-0"
                    />
                    <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-dark-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      <p className="text-xs text-dark-400 truncate">
                        {p.categoryName ?? "Uncategorised"}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-gold-400 font-bold text-sm">
                          {money(p.sellingPrice)}
                        </span>
                        <Badge tone={status.tone}>{p.stock} in stock</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-dark-800">
                    <Link
                      href={`/products/${p.id}/edit`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-dark-800 text-dark-200 text-sm hover:bg-dark-700 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </Link>
                    <button
                      onClick={() => printBarcodes([p.id])}
                      className="px-4 py-2 rounded-lg bg-dark-800 text-dark-400 hover:text-gold-400 transition-colors"
                      title="Print barcode"
                    >
                      <BarcodeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(p.id, p.name)}
                      disabled={deleting === p.id}
                      className="px-4 py-2 rounded-lg bg-dark-800 text-dark-400 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block glass-card rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 text-left">
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())
                      }
                      className="w-4 h-4 rounded accent-gold-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-sm font-medium text-dark-400">Product</th>
                  <th className="px-6 py-4 text-sm font-medium text-dark-400">Barcode</th>
                  <th className="px-6 py-4 text-sm font-medium text-dark-400">Cost</th>
                  <th className="px-6 py-4 text-sm font-medium text-dark-400">Price</th>
                  <th className="px-6 py-4 text-sm font-medium text-dark-400">Stock</th>
                  <th className="px-6 py-4 text-sm font-medium text-dark-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const status = stockStatus(p.stock, p.minStockLevel);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-dark-800/50 last:border-0 hover:bg-dark-800/30 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelected(p.id)}
                          className="w-4 h-4 rounded accent-gold-500"
                        />
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-dark-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{p.name}</p>
                            <p className="text-xs text-dark-400">
                              {p.categoryName ?? "Uncategorised"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-xs text-dark-300 font-mono">{p.barcode ?? "—"}</span>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-dark-300">{money(p.costPrice)}</td>
                      <td className="px-6 py-3.5 text-sm font-semibold text-gold-400">
                        {money(p.sellingPrice)}
                      </td>
                      <td className="px-6 py-3.5">
                        <Badge tone={status.tone}>
                          {p.stock} · min {p.minStockLevel}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/products/${p.id}/edit`}
                            className="p-2 rounded-lg text-dark-400 hover:text-gold-400 hover:bg-dark-800 transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => printBarcodes([p.id])}
                            className="p-2 rounded-lg text-dark-400 hover:text-gold-400 hover:bg-dark-800 transition-all"
                            title="Print barcode"
                          >
                            <BarcodeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => remove(p.id, p.name)}
                            disabled={deleting === p.id}
                            className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-dark-800 transition-all disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
