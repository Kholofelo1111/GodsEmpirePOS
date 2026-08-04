"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Truck, Phone, Mail, MapPin, User } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import { Field, inputClass, textareaClass } from "@/components/ui/Field";

interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

const emptyForm = { name: "", contactPerson: "", phone: "", email: "", address: "" };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/suppliers").then((r) => r.json());
      setSuppliers(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.contactPerson ?? "").toLowerCase().includes(term)
    );
  }, [suppliers, search]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Could not save supplier");
      setShowAdd(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save supplier");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-5">
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"} on file`}
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" /> Add Supplier
          </button>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers..." />

      {loading ? (
        <Spinner label="Loading suppliers..." />
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl">
          <EmptyState
            icon={<Truck className="w-6 h-6 text-dark-500" />}
            title="No suppliers yet"
            message="Add suppliers so you can link them to deliveries."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filtered.map((s) => (
            <div key={s.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-blue-400/10 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-6 h-6 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{s.name}</p>
                  {s.contactPerson && (
                    <p className="text-xs text-dark-400 flex items-center gap-1 truncate">
                      <User className="w-3 h-3" /> {s.contactPerson}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 pt-3 border-t border-dark-800 text-xs text-dark-400">
                {s.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {s.phone}
                  </p>
                )}
                {s.email && (
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" /> {s.email}
                  </p>
                )}
                {s.address && (
                  <p className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {s.address}
                  </p>
                )}
                {!s.phone && !s.email && !s.address && <p>No contact details captured</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Supplier">
        <form onSubmit={add} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          <Field label="Company name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Contact person">
            <input
              type="text"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
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
            {saving ? "Saving..." : "Add Supplier"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
