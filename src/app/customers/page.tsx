"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Users, Phone, Mail, Award, Receipt } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { Field, inputClass, textareaClass } from "@/components/ui/Field";
import { money, formatDate } from "@/lib/format";

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  loyaltyPoints: number;
}

interface CustomerDetail extends Customer {
  history: { id: number; receiptNumber: string; total: string; createdAt: string }[];
  totalSpent: number;
  visits: number;
}

const emptyForm = { name: "", phone: "", email: "", address: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/customers").then((r) => r.json());
      setCustomers(Array.isArray(data) ? data : []);
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

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Could not save customer");
      setShowAdd(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save customer");
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const data = await fetch(`/api/customers/${id}`).then((r) => r.json());
      setDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-5">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} registered customer${customers.length === 1 ? "" : "s"}`}
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" /> Add Customer
          </button>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search by name or phone..." />

      {loading ? (
        <Spinner label="Loading customers..." />
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl">
          <EmptyState
            icon={<Users className="w-6 h-6 text-dark-500" />}
            title="No customers yet"
            message="Add customers to track purchases and loyalty points."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => openDetail(c.id)}
              className="glass-card rounded-2xl p-5 text-left hover:border-gold-400/30 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gold-400/10 flex items-center justify-center text-lg font-bold text-gold-400 flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{c.name}</p>
                  <p className="text-xs text-dark-400 truncate">{c.phone ?? "No phone"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-dark-800">
                <span className="text-xs text-dark-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> Loyalty
                </span>
                <Badge tone="gold">{c.loyaltyPoints} pts</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add customer */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Customer">
        <form onSubmit={add} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          <Field label="Full name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
                placeholder="+27..."
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Address">
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              className={textareaClass}
            />
          </Field>
          <button
            type="submit"
            disabled={saving || !form.name}
            className="w-full py-3.5 gold-gradient text-dark-950 font-semibold rounded-xl disabled:opacity-40"
          >
            {saving ? "Saving..." : "Add Customer"}
          </button>
        </form>
      </Modal>

      {/* Customer detail */}
      <Modal
        open={!!detail || loadingDetail}
        onClose={() => setDetail(null)}
        title={detail?.name ?? "Customer"}
      >
        {loadingDetail || !detail ? (
          <Spinner />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-dark-900 rounded-xl p-3 text-center">
                <p className="text-xs text-dark-400">Spent</p>
                <p className="text-sm font-bold text-gold-400 mt-1">{money(detail.totalSpent)}</p>
              </div>
              <div className="bg-dark-900 rounded-xl p-3 text-center">
                <p className="text-xs text-dark-400">Visits</p>
                <p className="text-sm font-bold text-white mt-1">{detail.visits}</p>
              </div>
              <div className="bg-dark-900 rounded-xl p-3 text-center">
                <p className="text-xs text-dark-400">Points</p>
                <p className="text-sm font-bold text-green-400 mt-1">{detail.loyaltyPoints}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {detail.phone && (
                <p className="flex items-center gap-2 text-dark-300">
                  <Phone className="w-4 h-4 text-dark-500" /> {detail.phone}
                </p>
              )}
              {detail.email && (
                <p className="flex items-center gap-2 text-dark-300">
                  <Mail className="w-4 h-4 text-dark-500" /> {detail.email}
                </p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Purchase History</h4>
              {detail.history.length === 0 ? (
                <p className="text-sm text-dark-400 py-4 text-center">No purchases recorded yet.</p>
              ) : (
                <div className="divide-y divide-dark-800 max-h-60 overflow-y-auto">
                  {detail.history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Receipt className="w-4 h-4 text-dark-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{h.receiptNumber}</p>
                          <p className="text-xs text-dark-400">{formatDate(h.createdAt)}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gold-400">{money(h.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
