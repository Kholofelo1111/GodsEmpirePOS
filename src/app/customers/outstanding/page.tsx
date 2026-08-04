"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Users, CreditCard, ArrowLeft, CheckCircle, Banknote, Landmark, Ticket, AlertCircle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { Field, inputClass, selectClass, textareaClass } from "@/components/ui/Field";
import { money } from "@/lib/format";

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  loyaltyPoints: number;
  outstandingBalance: string | number;
}

export default function OutstandingCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Settlement modal state
  const [selected, setSelected] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/customers").then((r) => r.json());
      const list = Array.isArray(data) ? data : [];
      setCustomers(list.filter((c: Customer) => Number(c.outstandingBalance || 0) > 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term)
    );
  }, [customers, search]);

  const totalOutstanding = useMemo(() => {
    return customers.reduce((sum, c) => sum + Number(c.outstandingBalance || 0), 0);
  }, [customers]);

  const openSettleModal = (c: Customer) => {
    setSelected(c);
    setAmount(String(Number(c.outstandingBalance || 0)));
    setPaymentMethod("cash");
    setNotes("");
    setError("");
    setSuccess("");
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !amount) return;
    setProcessing(true);
    setError("");

    try {
      const res = await fetch("/api/customers/settle-debt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selected.id,
          amount: Number(amount),
          paymentMethod,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not settle balance.");
      }

      const resData = await res.json();
      setSuccess(
        `Received R ${Number(amount).toFixed(2)} from ${selected.name}. New outstanding balance: ${money(
          resData.newBalance
        )}`
      );
      setSelected(null);
      load();
      setTimeout(() => setSuccess(""), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not settle balance.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-5">
      <div className="flex items-center justify-between gap-3">
        <PageHeader
          title="Outstanding Balances"
          subtitle="Customers with unpaid credit and account balances"
        />
        <Link
          href="/customers"
          className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 text-dark-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> All Customers
        </Link>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/30 rounded-xl p-4 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
        </div>
      )}

      {/* Summary card */}
      <div className="glass-card rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-red-500">
        <div>
          <p className="text-xs text-dark-400 uppercase tracking-wider font-semibold">
            Total Outstanding Across All Accounts
          </p>
          <p className="text-2xl md:text-3xl font-bold text-red-500 mt-1">
            {money(totalOutstanding)}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search debtor by name or phone..."
      />

      {loading ? (
        <Spinner label="Loading outstanding accounts..." />
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl">
          <EmptyState
            icon={<CreditCard className="w-6 h-6 text-dark-500" />}
            title="No Outstanding Balances"
            message="All customer accounts are currently settled in full."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="glass-card rounded-2xl p-5 flex flex-col justify-between hover:border-red-400/30 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center font-bold text-red-400 flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{c.name}</p>
                      <p className="text-xs text-dark-400 truncate">{c.phone ?? "No phone"}</p>
                    </div>
                  </div>
                  <Badge tone="danger">Owes {money(c.outstandingBalance)}</Badge>
                </div>
                {c.notes && (
                  <p className="text-xs text-dark-400 bg-dark-900/60 p-2.5 rounded-lg mb-3 line-clamp-2">
                    {c.notes}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-dark-800 flex items-center justify-between mt-2">
                <span className="text-xs text-dark-400">Account balance</span>
                <button
                  onClick={() => openSettleModal(c)}
                  className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold text-xs rounded-xl transition-colors"
                >
                  Receive Payment
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settle Debt Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Settle Balance — ${selected.name}` : "Settle Balance"}
      >
        {selected && (
          <form onSubmit={handleSettle} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="p-4 bg-dark-900 rounded-xl flex items-center justify-between">
              <span className="text-sm text-dark-400">Current Debt</span>
              <span className="text-xl font-bold text-red-500">
                {money(selected.outstandingBalance)}
              </span>
            </div>

            <Field label="Amount to Receive (ZAR)" required>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={Number(selected.outstandingBalance)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
                required
              />
            </Field>

            <Field label="Payment Method">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={selectClass}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="eft">EFT / Bank Transfer</option>
                <option value="voucher">Voucher / Credit Note</option>
              </select>
            </Field>

            <Field label="Reference / Notes (Optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Receipt reference, transfer ID, etc."
                className={textareaClass}
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex-1 py-3 bg-dark-800 text-dark-300 hover:text-white rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing || !amount || Number(amount) <= 0}
                className="flex-1 py-3 gold-gradient text-dark-950 font-semibold rounded-xl disabled:opacity-40"
              >
                {processing ? "Processing..." : "Settle Balance"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
