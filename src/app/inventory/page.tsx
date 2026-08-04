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
  CheckCircle,
  Truck,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Field, inputClass, selectClass, textareaClass } from "@/components/ui/Field";
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

interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

type Tab = "stock" | "movements" | "suppliers";
type Filter = "all" | "low" | "out";

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  // Stock Out / Adjust Modal state
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<"out" | "adjustment">("out");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustRef, setAdjustRef] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, m, s] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/inventory-logs").then((r) => r.json()),
        fetch("/api/suppliers").then((r) => r.json()),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setMovements(Array.isArray(m) ? m : []);
      setSuppliers(Array.isArray(s) ? s : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct || !adjustQty) return;
    setSavingAdjust(true);
    setAdjustError("");

    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: adjustProduct.id,
          movementType: adjustType,
          quantity: Number(adjustQty),
          newStock: adjustType === "adjustment" ? Number(adjustQty) : undefined,
          reference: adjustRef || (adjustType === "out" ? "Wastage / Stock Out" : "Stock Adjustment"),
          notes: adjustNotes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not adjust stock.");
      }

      const resData = await res.json();
      setSuccess(
        `Updated ${adjustProduct.name} stock: ${resData.previousStock} → ${resData.newStock}`
      );
      setShowAdjust(false);
      setAdjustProduct(null);
      setAdjustQty("");
      setAdjustRef("");
      setAdjustNotes("");
      load();
      setTimeout(() => setSuccess(""), 6000);
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "Could not adjust stock.");
    } finally {
      setSavingAdjust(false);
    }
  };

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
        subtitle="Stock levels, valuation, adjustments and movement history"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAdjustType("out");
                setShowAdjust(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold text-sm rounded-xl transition-colors"
            >
              <PackageX className="w-4 h-4" /> Stock Out / Adjust
            </button>
            <Link
              href="/stock-in"
              className="flex items-center gap-2 px-4 py-2.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              <ArrowDownCircle className="w-5 h-5" /> Stock In
            </Link>
          </div>
        }
      />

      {success && (
        <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/30 rounded-xl p-4 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
        </div>
      )}

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
        <button
          onClick={() => setTab("suppliers")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "suppliers" ? "gold-gradient text-dark-950" : "bg-dark-800 text-dark-300"
          }`}
        >
          Supplier History
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
      ) : tab === "movements" ? (
        movements.length === 0 ? (
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
        )
      ) : (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-gold-400" /> Supplier History & Directory
            </h2>
            <Link href="/suppliers" className="text-xs text-gold-400 hover:underline">
              Manage Suppliers →
            </Link>
          </div>
          {suppliers.length === 0 ? (
            <EmptyState
              icon={<Truck className="w-6 h-6 text-dark-500" />}
              title="No suppliers listed"
              message="Add suppliers to record delivery sources."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {suppliers.map((s) => (
                <div key={s.id} className="p-4 bg-dark-900 rounded-xl flex flex-col justify-between">
                  <div>
                    <p className="font-semibold text-white">{s.name}</p>
                    {s.contactPerson && <p className="text-xs text-dark-400 mt-1">{s.contactPerson}</p>}
                    {s.phone && <p className="text-xs text-dark-300 mt-0.5">{s.phone}</p>}
                    {s.email && <p className="text-xs text-dark-400 truncate">{s.email}</p>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-dark-800 flex items-center justify-between">
                    <span className="text-xs text-dark-400">Supplier #{s.id}</span>
                    <Link
                      href="/stock-in"
                      className="px-3 py-1.5 bg-dark-800 hover:bg-dark-700 text-xs text-dark-200 rounded-lg font-medium transition-colors"
                    >
                      Receive from Supplier
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Adjust / Stock Out Modal */}
      <Modal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        title="Stock Out / Inventory Adjustment"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          {adjustError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {adjustError}
            </div>
          )}

          <Field label="Movement Type" required>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as "out" | "adjustment")}
              className={selectClass}
            >
              <option value="out">Stock Out (Wastage, Damage, Write-off, Supplier Return)</option>
              <option value="adjustment">Stock Adjustment (Set new exact stock level)</option>
            </select>
          </Field>

          <Field label="Select Product" required>
            <select
              value={adjustProduct?.id || ""}
              onChange={(e) => {
                const found = products.find((p) => p.id === Number(e.target.value));
                setAdjustProduct(found || null);
              }}
              className={selectClass}
              required
            >
              <option value="">-- Choose item --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current: {p.stock})
                </option>
              ))}
            </select>
          </Field>

          {adjustProduct && (
            <div className="p-3 bg-dark-900 rounded-xl flex items-center justify-between text-xs">
              <span className="text-dark-400">Current On Hand</span>
              <span className="font-bold text-white text-sm">{adjustProduct.stock} units</span>
            </div>
          )}

          <Field
            label={
              adjustType === "out" ? "Quantity Removed / Written Off" : "New Target Stock Level"
            }
            required
          >
            <input
              type="number"
              min="0"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="0"
              className={inputClass}
              required
            />
          </Field>

          <Field label="Reference / Reason">
            <input
              type="text"
              value={adjustRef}
              onChange={(e) => setAdjustRef(e.target.value)}
              placeholder={adjustType === "out" ? "Damaged package #12" : "Quarterly Stocktake #3"}
              className={inputClass}
            />
          </Field>

          <Field label="Notes (Optional)">
            <textarea
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              rows={2}
              placeholder="Additional explanation or auditor initials"
              className={textareaClass}
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAdjust(false)}
              className="flex-1 py-3 bg-dark-800 text-dark-300 hover:text-white rounded-xl text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingAdjust || !adjustProduct || !adjustQty}
              className="flex-1 py-3 gold-gradient text-dark-950 font-semibold rounded-xl disabled:opacity-40"
            >
              {savingAdjust ? "Saving..." : "Record Adjustment"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
