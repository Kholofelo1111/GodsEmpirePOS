"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  AlertTriangle,
  PackageX,
  Warehouse,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings2,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import { money, stockStatus, formatDateTime } from "@/lib/format";

interface Product {
  id: number;
  name: string;
  barcode: string | null;
  costPrice: string;
  sellingPrice: string;
  stock: number;
  minStockLevel: number;
}

interface Movement {
  id: number;
  productName: string | null;
  movementType: "in" | "out" | "adjustment";
  quantity: number;
  previousStock: number;
  newStock: number;
  reference: string | null;
  createdAt: string;
}

type Tab = "stock" | "movements";
type Filter = "all" | "low" | "out";

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/inventory-logs").then((r) => r.json()),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setMovements(Array.isArray(m) ? m : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const cost = products.reduce((s, p) => s + Number(p.costPrice) * p.stock, 0);
    const retail = products.reduce((s, p) => s + Number(p.sellingPrice) * p.stock, 0);
    const low = products.filter((p) => p.stock > 0 && p.stock <= p.minStockLevel).length;
    const out = products.filter((p) => p.stock <= 0).length;
    const units = products.reduce((s, p) => s + p.stock, 0);
    return { cost, retail, low, out, units };
  }, [products]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesTerm =
        !term || p.name.toLowerCase().includes(term) || (p.barcode ?? "").includes(term);
      if (!matchesTerm) return false;
      if (filter === "low") return p.stock > 0 && p.stock <= p.minStockLevel;
      if (filter === "out") return p.stock <= 0;
      return true;
    });
  }, [products, search, filter]);

  return (
    <div className="animate-fadeIn space-y-5">
      <PageHeader
        title="Inventory"
        subtitle="Stock levels, valuation and movement history"
        action={
          <Link
            href="/stock-in"
            className="flex items-center gap-2 px-4 py-2.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <ArrowDownCircle className="w-5 h-5" /> Stock In
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Stock Value (cost)"
          value={money(totals.cost)}
          hint={`${totals.units} units`}
          tone="purple"
          icon={<Warehouse className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />}
        />
        <StatCard
          label="Retail Value"
          value={money(totals.retail)}
          hint={`${money(totals.retail - totals.cost)} potential margin`}
          tone="green"
          icon={<Package className="w-5 h-5 md:w-6 md:h-6 text-green-400" />}
        />
        <StatCard
          label="Low Stock"
          value={String(totals.low)}
          tone="orange"
          icon={<AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-orange-400" />}
        />
        <StatCard
          label="Out of Stock"
          value={String(totals.out)}
          tone="red"
          icon={<PackageX className="w-5 h-5 md:w-6 md:h-6 text-red-400" />}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("stock")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "stock" ? "gold-gradient text-dark-950" : "bg-dark-800 text-dark-300"
          }`}
        >
          Current Stock
        </button>
        <button
          onClick={() => setTab("movements")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "movements" ? "gold-gradient text-dark-950" : "bg-dark-800 text-dark-300"
          }`}
        >
          Movement History
        </button>
      </div>

      {loading ? (
        <Spinner label="Loading inventory..." />
      ) : tab === "stock" ? (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Search inventory..." />
            </div>
            <div className="flex gap-2">
              {(["all", "low", "out"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    filter === f
                      ? "gold-gradient text-dark-950"
                      : "bg-dark-800 text-dark-300 hover:text-white"
                  }`}
                >
                  {f === "all" ? "All" : f === "low" ? "Low" : "Out"}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="glass-card rounded-2xl">
              <EmptyState
                icon={<Package className="w-6 h-6 text-dark-500" />}
                title="Nothing to show"
                message="No products match this filter."
              />
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-dark-800 text-left">
                      <th className="px-4 md:px-6 py-4 text-sm font-medium text-dark-400">Product</th>
                      <th className="px-4 md:px-6 py-4 text-sm font-medium text-dark-400">Stock</th>
                      <th className="px-4 md:px-6 py-4 text-sm font-medium text-dark-400">Min</th>
                      <th className="px-4 md:px-6 py-4 text-sm font-medium text-dark-400">Value</th>
                      <th className="px-4 md:px-6 py-4 text-sm font-medium text-dark-400">Status</th>
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
                          <td className="px-4 md:px-6 py-3.5">
                            <p className="text-sm font-medium text-white">{p.name}</p>
                            <p className="text-xs text-dark-400 font-mono">{p.barcode ?? "—"}</p>
                          </td>
                          <td className="px-4 md:px-6 py-3.5 text-sm font-semibold text-white">
                            {p.stock}
                          </td>
                          <td className="px-4 md:px-6 py-3.5 text-sm text-dark-400">
                            {p.minStockLevel}
                          </td>
                          <td className="px-4 md:px-6 py-3.5 text-sm text-dark-300">
                            {money(Number(p.costPrice) * p.stock)}
                          </td>
                          <td className="px-4 md:px-6 py-3.5">
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : movements.length === 0 ? (
        <div className="glass-card rounded-2xl">
          <EmptyState
            icon={<Warehouse className="w-6 h-6 text-dark-500" />}
            title="No stock movements yet"
            message="Sales and deliveries will be logged here."
          />
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-4 md:p-5">
          <div className="divide-y divide-dark-800">
            {movements.map((m) => {
              const isIn = m.movementType === "in";
              const isAdj = m.movementType === "adjustment";
              return (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isIn ? "bg-green-400/10" : isAdj ? "bg-blue-400/10" : "bg-orange-400/10"
                    }`}
                  >
                    {isIn ? (
                      <ArrowDownCircle className="w-4 h-4 text-green-400" />
                    ) : isAdj ? (
                      <Settings2 className="w-4 h-4 text-blue-400" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4 text-orange-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {m.productName ?? "Deleted product"}
                    </p>
                    <p className="text-xs text-dark-400 truncate">
                      {m.reference ?? m.movementType} · {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-sm font-semibold ${
                        isIn ? "text-green-400" : isAdj ? "text-blue-400" : "text-orange-400"
                      }`}
                    >
                      {isIn ? "+" : isAdj ? "±" : "−"}
                      {m.quantity}
                    </p>
                    <p className="text-xs text-dark-500">
                      {m.previousStock} → {m.newStock}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
