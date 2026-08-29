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
  ScanLine,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import { Field, inputClass, selectClass, textareaClass } from "@/components/ui/Field";
import { money, stockStatus, formatDateTime } from "@/lib/format";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";
import { cacheProducts, getCachedProducts, queueStockAdjustment } from "@/lib/offline/db";
import OfflineBadge from "@/components/offline/OfflineBadge";

const WASTAGE_REASONS = ["Expired", "Damaged", "Customer Return", "Wastage", "Other"] as const;

interface Product {
  id: number;
  name: string;
  barcode: string | null;
  costPrice: string;
  sellingPrice: string;
  stock: number;
  minStockLevel: number;
  expiryDate: string | null;
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

type Tab = "stock" | "movements" | "suppliers" | "expiry";
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
  const { online, pending, syncing, refreshPendingCount } = useOfflineSync();
  const [adjustError, setAdjustError] = useState("");
  const [success, setSuccess] = useState("");

  // Quick find (search / scan) for the Stock Out / Adjust product picker —
  // avoids scrolling the full 300+ item dropdown below.
  const [productQuery, setProductQuery] = useState("");
  const [productMatches, setProductMatches] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [showWastageScanner, setShowWastageScanner] = useState(false);
  const [wastageReason, setWastageReason] = useState<typeof WASTAGE_REASONS[number]>("Expired");

  // Expiry management (Phase 4/5): configurable warning period + savingWarn state.
  const [warningDays, setWarningDays] = useState(30);
  const [savingWarningDays, setSavingWarningDays] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, m, s, exp] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/inventory-logs").then((r) => r.json()),
        fetch("/api/suppliers").then((r) => r.json()),
        fetch("/api/settings/expiry").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const productList = Array.isArray(p) ? p : [];
      setProducts(productList);
      setMovements(Array.isArray(m) ? m : []);
      setSuppliers(Array.isArray(s) ? s : []);
      if (exp && Number.isFinite(exp.warningDays)) setWarningDays(exp.warningDays);
      cacheProducts(productList);
    } catch {
      // Offline / unreachable — keep stock usable with the last cached
      // snapshot instead of an empty list. Movements/suppliers aren't
      // cached (read-only history, not needed to keep selling/adjusting).
      const cached = await getCachedProducts();
      if (cached.length > 0) {
        setProducts(cached as typeof products);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced quick-find search for the Stock Out / Adjust product picker,
  // reusing the existing /api/products?search= endpoint (matches name or
  // barcode) instead of building new search logic.
  useEffect(() => {
    const term = productQuery.trim();
    if (!term) {
      setProductMatches([]);
      return;
    }
    setSearchingProducts(true);
    const t = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(term)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => setProductMatches(Array.isArray(rows) ? rows.slice(0, 8) : []))
        .catch(() => setProductMatches([]))
        .finally(() => setSearchingProducts(false));
    }, 300);
    return () => clearTimeout(t);
  }, [productQuery]);

  async function handleWastageScan(code: string) {
    setShowWastageScanner(false);
    try {
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(code)}`);
      const matches: Product[] = res.ok ? await res.json() : [];
      if (matches[0]) {
        setAdjustProduct(matches[0]);
        setProductQuery("");
        setProductMatches([]);
      } else {
        setAdjustError(`No product found for barcode ${code}`);
      }
    } catch {
      setAdjustError("Barcode lookup failed — check your connection and try again.");
    }
  }

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct || !adjustQty) return;
    setSavingAdjust(true);
    setAdjustError("");

    const reference =
      adjustType === "out"
        ? wastageReason === "Other"
          ? adjustRef || "Other"
          : wastageReason
        : adjustRef || "Stock Adjustment";

    const payload = {
      productId: adjustProduct.id,
      movementType: adjustType,
      quantity: Number(adjustQty),
      newStock: adjustType === "adjustment" ? Number(adjustQty) : undefined,
      reference,
      notes: adjustNotes || null,
    };

    const finishLocally = (message: string) => {
      setSuccess(message);
      setShowAdjust(false);
      setAdjustProduct(null);
      setAdjustQty("");
      setAdjustRef("");
      setAdjustNotes("");
      setWastageReason("Expired");
      setProductQuery("");
      setProductMatches([]);
      setTimeout(() => setSuccess(""), 6000);
    };

    // Offline: queue the adjustment and apply it optimistically to the
    // on-screen stock figure so subsequent scans/searches reflect it
    // immediately, even before it's synced. Single-device scope — no
    // attempt to reconcile with adjustments made elsewhere meanwhile.
    if (!online) {
      try {
        await queueStockAdjustment(payload);
        await refreshPendingCount();
        const qty = Number(adjustQty);
        setProducts((prev) =>
          prev.map((p) =>
            p.id === adjustProduct.id
              ? { ...p, stock: adjustType === "adjustment" ? qty : Math.max(0, p.stock - qty) }
              : p
          )
        );
        finishLocally(`Queued offline: ${adjustProduct.name} stock update will sync when back online.`);
      } catch (err) {
        setAdjustError(err instanceof Error ? err.message : "Could not queue offline stock update.");
      } finally {
        setSavingAdjust(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not adjust stock.");
      }

      const resData = await res.json();
      finishLocally(`Updated ${adjustProduct.name} stock: ${resData.previousStock} → ${resData.newStock}`);
      load();
    } catch (err) {
      if (err instanceof TypeError) {
        try {
          await queueStockAdjustment(payload);
          await refreshPendingCount();
          const qty = Number(adjustQty);
          setProducts((prev) =>
            prev.map((p) =>
              p.id === adjustProduct.id
                ? { ...p, stock: adjustType === "adjustment" ? qty : Math.max(0, p.stock - qty) }
                : p
            )
          );
          finishLocally(`Queued offline: ${adjustProduct.name} stock update will sync when back online.`);
        } catch (queueErr) {
          setAdjustError(queueErr instanceof Error ? queueErr.message : "Could not adjust stock.");
        }
      } else {
        setAdjustError(err instanceof Error ? err.message : "Could not adjust stock.");
      }
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

  // Phase 5: categorize products by expiry status using the configurable
  // warningDays period. Purely a client-side read of products.expiryDate —
  // no separate expiry API needed.
  const expiryGroups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const warningMs = warningDays * 24 * 60 * 60 * 1000;

    const expired: Product[] = [];
    const expiringSoon: Product[] = [];
    const noExpiry: Product[] = [];

    for (const p of products) {
      if (!p.expiryDate) {
        noExpiry.push(p);
        continue;
      }
      const exp = new Date(p.expiryDate);
      if (Number.isNaN(exp.getTime())) {
        noExpiry.push(p);
        continue;
      }
      const diff = exp.getTime() - today.getTime();
      if (diff < 0) {
        expired.push(p);
      } else if (diff <= warningMs) {
        expiringSoon.push(p);
      }
    }

    expired.sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());
    expiringSoon.sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());

    return { expired, expiringSoon, noExpiry };
  }, [products, warningDays]);

  async function updateWarningDays(days: number) {
    setWarningDays(days);
    setSavingWarningDays(true);
    try {
      await fetch("/api/settings/expiry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warningDays: days }),
      });
    } catch {
      // Non-critical — the selection still applies locally for this session.
    } finally {
      setSavingWarningDays(false);
    }
  }

  return (
    <div className="animate-fadeIn space-y-5">
      <OfflineBadge online={online} pending={pending} syncing={syncing} />
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
        <button
          onClick={() => setTab("expiry")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
            tab === "expiry" ? "gold-gradient text-dark-950" : "bg-dark-800 text-dark-300"
          }`}
        >
          Expiry
          {(expiryGroups.expired.length > 0 || expiryGroups.expiringSoon.length > 0) && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                tab === "expiry" ? "bg-dark-950/20 text-dark-950" : "bg-red-500/20 text-red-400"
              }`}
            >
              {expiryGroups.expired.length + expiryGroups.expiringSoon.length}
            </span>
          )}
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
      ) : tab === "suppliers" ? (
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
      ) : (
        <div className="space-y-5">
          <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Expiry Management</h2>
              <p className="text-xs text-dark-400 mt-0.5">
                Products are flagged "Expiring Soon" once they fall inside the warning period below.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-dark-400 whitespace-nowrap">Warn me</span>
              <select
                value={warningDays}
                onChange={(e) => updateWarningDays(Number(e.target.value))}
                disabled={savingWarningDays}
                className={selectClass}
              >
                <option value={7}>1 week before</option>
                <option value={14}>2 weeks before</option>
                <option value={30}>1 month before</option>
              </select>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 md:p-5">
            <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
              <PackageX className="w-4 h-4" /> Expired ({expiryGroups.expired.length})
            </h3>
            {expiryGroups.expired.length === 0 ? (
              <p className="text-sm text-dark-500">No expired products.</p>
            ) : (
              <div className="divide-y divide-dark-800">
                {expiryGroups.expired.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      <p className="text-xs text-dark-400">Expired {p.expiryDate}</p>
                    </div>
                    <button
                      onClick={() => {
                        const found = products.find((prod) => prod.id === p.id);
                        setAdjustType("out");
                        setWastageReason("Expired");
                        setAdjustProduct(found || null);
                        setShowAdjust(true);
                      }}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium rounded-lg flex-shrink-0"
                    >
                      Remove Stock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-2xl p-4 md:p-5">
            <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" /> Expiring Soon ({expiryGroups.expiringSoon.length})
            </h3>
            {expiryGroups.expiringSoon.length === 0 ? (
              <p className="text-sm text-dark-500">Nothing expiring within the warning period.</p>
            ) : (
              <div className="divide-y divide-dark-800">
                {expiryGroups.expiringSoon.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      <p className="text-xs text-dark-400">Expires {p.expiryDate}</p>
                    </div>
                    <Link
                      href={`/products/edit?id=${p.id}`}
                      className="px-3 py-1.5 bg-dark-800 hover:bg-dark-700 text-xs text-dark-200 rounded-lg flex-shrink-0"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-2xl p-4 md:p-5">
            <h3 className="text-sm font-semibold text-dark-300 flex items-center gap-2 mb-3">
              <Package className="w-4 h-4" /> No Expiry Date ({expiryGroups.noExpiry.length})
            </h3>
            <p className="text-xs text-dark-500">
              Products without an expiry date set. Add one from each product's edit page if applicable.
            </p>
          </div>
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
            <div className="space-y-2 mb-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Quick find by name or barcode..."
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setShowWastageScanner(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-800 text-dark-200 hover:bg-dark-700 text-sm font-medium whitespace-nowrap"
                >
                  <ScanLine className="w-4 h-4" /> Scan
                </button>
              </div>
              {searchingProducts && (
                <p className="text-xs text-dark-500">Searching…</p>
              )}
              {productMatches.length > 0 && (
                <div className="rounded-xl border border-dark-700 divide-y divide-dark-800 overflow-hidden">
                  {productMatches.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => {
                        setAdjustProduct(p);
                        setProductQuery("");
                        setProductMatches([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-dark-800 flex items-center justify-between gap-2"
                    >
                      <span className="text-white">{p.name}</span>
                      <span className="text-dark-400 text-xs flex-shrink-0">Stock: {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select
              value={adjustProduct?.id || ""}
              onChange={(e) => {
                const found = products.find((p) => p.id === Number(e.target.value));
                setAdjustProduct(found || null);
              }}
              className={selectClass}
              required
            >
              <option value="">-- Or choose from full list --</option>
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

          {adjustType === "out" &&
            adjustProduct &&
            Number(adjustQty) > adjustProduct.stock && (
              <p className="text-xs text-orange-400">
                Only {adjustProduct.stock} in stock — removing {adjustQty} will bring it to 0.
              </p>
            )}

          {adjustType === "out" ? (
            <Field label="Reason" required>
              <select
                value={wastageReason}
                onChange={(e) => setWastageReason(e.target.value as typeof WASTAGE_REASONS[number])}
                className={selectClass}
              >
                {WASTAGE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Reference / Reason">
              <input
                type="text"
                value={adjustRef}
                onChange={(e) => setAdjustRef(e.target.value)}
                placeholder="Quarterly Stocktake #3"
                className={inputClass}
              />
            </Field>
          )}

          {adjustType === "out" && wastageReason === "Other" && (
            <Field label="Describe reason">
              <input
                type="text"
                value={adjustRef}
                onChange={(e) => setAdjustRef(e.target.value)}
                placeholder="Describe the reason for removal"
                className={inputClass}
              />
            </Field>
          )}

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

      <BarcodeScanner
        open={showWastageScanner}
        onClose={() => setShowWastageScanner(false)}
        onScan={handleWastageScan}
        title="Scan Product to Remove"
      />
    </div>
  );
}
