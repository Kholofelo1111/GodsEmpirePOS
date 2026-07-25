"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Receipt, Printer, Eye, Banknote, CreditCard } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { money, formatDateTime } from "@/lib/format";
import type { BusinessInfo } from "@/lib/queries";

interface Sale {
  id: number;
  receiptNumber: string;
  total: string;
  paymentMethod: "cash" | "card";
  createdAt: string;
}

interface SaleDetail extends Sale {
  subtotal: string;
  discount: string;
  vatAmount: string;
  amountTendered: string | null;
  changeGiven: string | null;
  cashier: string | null;
  customerName: string | null;
  items: { id: number; name: string | null; quantity: number; unitPrice: string; totalPrice: string }[];
}

export default function ReceiptsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        fetch("/api/sales").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ]);
      setSales(Array.isArray(s) ? s : []);
      setBusiness(b);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sales;
    return sales.filter((s) => s.receiptNumber.toLowerCase().includes(term));
  }, [sales, search]);

  const totalToday = useMemo(() => {
    const today = new Date().toDateString();
    return sales
      .filter((s) => new Date(s.createdAt).toDateString() === today)
      .reduce((sum, s) => sum + Number(s.total), 0);
  }, [sales]);

  const open = async (id: number) => {
    setLoadingDetail(true);
    try {
      const data = await fetch(`/api/sales/${id}`).then((r) => r.json());
      setDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-5">
      <PageHeader
        title="Receipts"
        subtitle={`${sales.length} transaction${sales.length === 1 ? "" : "s"} · ${money(
          totalToday
        )} today`}
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search receipt number..." />

      {loading ? (
        <Spinner label="Loading receipts..." />
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl">
          <EmptyState
            icon={<Receipt className="w-6 h-6 text-dark-500" />}
            title="No receipts found"
            message="Completed sales appear here."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filtered.map((sale) => (
            <button
              key={sale.id}
              onClick={() => open(sale.id)}
              className="glass-card rounded-2xl p-5 text-left hover:border-gold-400/30 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-5 h-5 text-gold-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{sale.receiptNumber}</p>
                  <p className="text-xs text-dark-400">{formatDateTime(sale.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-dark-800">
                <Badge tone={sale.paymentMethod === "cash" ? "success" : "info"}>
                  <span className="flex items-center gap-1">
                    {sale.paymentMethod === "cash" ? (
                      <Banknote className="w-3 h-3" />
                    ) : (
                      <CreditCard className="w-3 h-3" />
                    )}
                    {sale.paymentMethod}
                  </span>
                </Badge>
                <span className="text-base font-bold text-gold-400">{money(sale.total)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={!!detail || loadingDetail}
        onClose={() => setDetail(null)}
        title={detail?.receiptNumber ?? "Receipt"}
      >
        {loadingDetail || !detail ? (
          <Spinner />
        ) : (
          <>
            <div id="receipt" className="bg-white text-black rounded-xl p-5 font-mono text-[12px]">
              <div className="text-center mb-3">
                <p className="font-bold text-base">{business?.name ?? "God's Empire"}</p>
                <p className="text-[10px] leading-tight">{business?.address}</p>
                <p className="text-[10px]">{business?.phone}</p>
              </div>

              <div className="border-t border-dashed border-black/40 py-2 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Receipt</span>
                  <span>{detail.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date</span>
                  <span>{formatDateTime(detail.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier</span>
                  <span>{detail.cashier ?? "Store Operator"}</span>
                </div>
                {detail.customerName && (
                  <div className="flex justify-between">
                    <span>Customer</span>
                    <span>{detail.customerName}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-black/40 py-2 space-y-1">
                {detail.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {item.quantity} × {item.name ?? "Item"}
                    </span>
                    <span>{money(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black/40 py-2 space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(detail.subtotal)}</span>
                </div>
                {Number(detail.discount) > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>-{money(detail.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>VAT</span>
                  <span>{money(detail.vatAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-black/30 mt-1 pt-1">
                  <span>TOTAL</span>
                  <span>{money(detail.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid ({detail.paymentMethod})</span>
                  <span>{money(detail.amountTendered ?? detail.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change</span>
                  <span>{money(detail.changeGiven ?? 0)}</span>
                </div>
              </div>

              <p className="text-center text-[10px] border-t border-dashed border-black/40 pt-2">
                {business?.receiptFooter}
              </p>
            </div>

            <div className="flex gap-3 mt-5 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-dark-800 text-dark-200 rounded-xl hover:bg-dark-700 transition-colors"
              >
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
              <button
                onClick={() => setDetail(null)}
                className="px-6 py-3 gold-gradient text-dark-950 font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
