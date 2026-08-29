"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Users, ShieldCheck, KeyRound, Pencil, IdCard, CalendarDays, Banknote } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import { Field, inputClass, selectClass } from "@/components/ui/Field";

interface StaffPerformance {
  totalSales: number;
  totalRevenue: number;
  todaySales: number;
  todayRevenue: number;
}

interface StaffMember {
  id: number;
  username: string;
  fullName: string;
  displayName: string | null;
  role: "owner" | "manager" | "cashier";
  isActive: boolean;
  createdAt: string;
  performance: StaffPerformance;
}

interface CashUpDay {
  total: number;
  transactions: number;
  payments: { method: string; amount: number }[];
  productsSold: { productId: number; name: string; quantity: number; revenue: number }[];
  cashierBreakdown: {
    userId: number;
    name: string;
    role: string;
    transactions: number;
    revenue: number;
    cash: number;
    card: number;
    other: number;
  }[];
}

type EditKind = "fullName" | "displayName" | "password" | null;

const money = (n: number) => `R${Number(n || 0).toFixed(2)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function StaffManagement({ role }: { role: "owner" | "manager" | "cashier" | null }) {
  const isOwner = role === "owner";

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: "",
    displayName: "",
    username: "",
    password: "",
    role: "cashier" as "cashier" | "manager",
  });

  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [editKind, setEditKind] = useState<EditKind>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [cashUpDate, setCashUpDate] = useState(todayStr());
  const [cashUp, setCashUp] = useState<CashUpDay | null>(null);
  const [cashUpLoading, setCashUpLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load staff");
      setStaff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!cashUpDate) return;
    setCashUpLoading(true);
    fetch(`/api/cash-up?date=${cashUpDate}`)
      .then((r) => r.json())
      .then((data) => setCashUp(data.error ? null : data))
      .catch(() => setCashUp(null))
      .finally(() => setCashUpLoading(false));
  }, [cashUpDate]);

  async function addStaff() {
    if (!addForm.fullName.trim() || !addForm.username.trim() || !addForm.password) {
      setError("Full name, username and password are required.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create staff member");
      setAddForm({ fullName: "", displayName: "", username: "", password: "", role: "cashier" });
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create staff member");
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(member: StaffMember) {
    setError("");
    try {
      const res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, isActive: !member.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update staff status");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update staff status");
    }
  }

  function openEdit(member: StaffMember, kind: EditKind) {
    setEditTarget(member);
    setEditKind(kind);
    setEditValue(
      kind === "fullName" ? member.fullName : kind === "displayName" ? member.displayName ?? "" : ""
    );
  }

  async function saveEdit() {
    if (!editTarget || !editKind) return;
    if (editKind === "password" && !editValue) {
      setError("Enter a new password.");
      return;
    }
    if (editKind === "fullName" && !editValue.trim()) {
      setError("Full name can't be empty.");
      return;
    }
    setEditSaving(true);
    setError("");
    try {
      const patch: Record<string, string> = { [editKind]: editValue };
      const res = await fetch("/api/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editTarget.id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update staff member");
      setEditTarget(null);
      setEditKind(null);
      setEditValue("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update staff member");
    } finally {
      setEditSaving(false);
    }
  }

  const editTitle =
    editKind === "fullName" ? "Edit Full Name" : editKind === "displayName" ? "Edit Display Name" : "Change Password";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Staff Management</h2>
          <p className="text-sm text-dark-400 mt-1">
            {isOwner
              ? "Manage cashiers and managers, accounts and performance."
              : "View staff and sales performance."}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => {
              setShowAdd(!showAdd);
              setError("");
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <Users className="w-4 h-4" />
            {showAdd ? "Cancel" : "Add Staff"}
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-400/30 bg-red-400/10 text-red-300 text-sm">{error}</div>
      )}

      {isOwner && showAdd && (
        <div className="p-5 rounded-xl bg-dark-900 border border-dark-700 space-y-4">
          <h3 className="font-semibold text-white">Add Staff Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full name" required>
              <input
                value={addForm.fullName}
                onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                className={inputClass}
                placeholder="e.g. Thabo Mokoena"
              />
            </Field>
            <Field label="Display name" hint="Name shown on the POS and receipts.">
              <input
                value={addForm.displayName}
                onChange={(e) => setAddForm({ ...addForm, displayName: e.target.value })}
                className={inputClass}
                placeholder="e.g. Thabo"
              />
            </Field>
            <Field label="Username" required>
              <input
                value={addForm.username}
                onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                className={inputClass}
                placeholder="Login username"
              />
            </Field>
            <Field label="Password" required>
              <input
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className={inputClass}
                placeholder="Login password"
              />
            </Field>
            <Field label="Role">
              <select
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value as "cashier" | "manager" })}
                className={selectClass}
              >
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
              </select>
            </Field>
          </div>
          <button
            onClick={addStaff}
            disabled={adding}
            className="flex items-center gap-2 px-5 py-3 gold-gradient text-dark-950 font-semibold rounded-xl disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {adding ? "Creating..." : "Create Staff Account"}
          </button>
        </div>
      )}

      {loading && (
        <div className="py-8">
          <Spinner label="Loading staff..." />
        </div>
      )}

      {!loading && staff.length === 0 && (
        <div className="text-center py-10 rounded-xl bg-dark-900 border border-dark-700">
          <Users className="w-10 h-10 mx-auto text-dark-500 mb-3" />
          <p className="text-white font-medium">No staff members yet</p>
          {isOwner && <p className="text-dark-400 text-sm mt-1">Add your first cashier or manager above.</p>}
        </div>
      )}

      {!loading && staff.length > 0 && (
        <div className="space-y-4">
          {staff.map((member) => (
            <div key={member.id} className="rounded-xl bg-dark-900 border border-dark-700 p-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-white font-semibold text-base">{member.displayName || member.fullName}</h3>
                    <span className="px-2.5 py-1 rounded-lg bg-gold-400/10 text-gold-400 text-xs font-medium capitalize">
                      {member.role}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        member.isActive ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                      }`}
                    >
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-dark-400 text-sm mt-1">
                    @{member.username}
                    {member.displayName && member.displayName !== member.fullName && ` • ${member.fullName}`}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    <div className="bg-dark-800 rounded-xl p-3">
                      <p className="text-xs text-dark-400">Today Sales</p>
                      <p className="text-lg font-semibold text-white mt-1">{member.performance.todaySales}</p>
                    </div>
                    <div className="bg-dark-800 rounded-xl p-3">
                      <p className="text-xs text-dark-400">Today Revenue</p>
                      <p className="text-lg font-semibold text-white mt-1">{money(member.performance.todayRevenue)}</p>
                    </div>
                    <div className="bg-dark-800 rounded-xl p-3">
                      <p className="text-xs text-dark-400">Total Sales</p>
                      <p className="text-lg font-semibold text-white mt-1">{member.performance.totalSales}</p>
                    </div>
                    <div className="bg-dark-800 rounded-xl p-3">
                      <p className="text-xs text-dark-400">Total Revenue</p>
                      <p className="text-lg font-semibold text-white mt-1">{money(member.performance.totalRevenue)}</p>
                    </div>
                  </div>
                </div>

                {isOwner && member.role !== "owner" && (
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2">
                    <button
                      onClick={() => toggleActive(member)}
                      className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        member.isActive
                          ? "border-red-400/30 text-red-300 hover:bg-red-400/10"
                          : "border-green-400/30 text-green-300 hover:bg-green-400/10"
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {member.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => openEdit(member, "fullName")}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-dark-800 text-dark-200 hover:text-white"
                    >
                      <Pencil className="w-4 h-4" /> Edit Name
                    </button>
                    <button
                      onClick={() => openEdit(member, "displayName")}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-dark-800 text-dark-200 hover:text-white"
                    >
                      <IdCard className="w-4 h-4" /> Edit Display
                    </button>
                    <button
                      onClick={() => openEdit(member, "password")}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-dark-800 text-dark-200 hover:text-white"
                    >
                      <KeyRound className="w-4 h-4" /> Change Password
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-dark-900 border border-dark-700 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Banknote className="w-4 h-4 text-gold-400" /> Cash-Up Summary
            </h3>
            <p className="text-xs text-dark-400 mt-1">Daily sales and payment breakdown for {cashUpDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-dark-400" />
            <input
              type="date"
              value={cashUpDate}
              max={todayStr()}
              onChange={(e) => setCashUpDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {cashUpLoading && (
          <div className="py-6">
            <Spinner label="Loading cash-up..." />
          </div>
        )}

        {!cashUpLoading && cashUp && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-dark-800 rounded-xl p-3">
                <p className="text-xs text-dark-400">Total Revenue</p>
                <p className="text-lg font-semibold text-white mt-1">{money(cashUp.total)}</p>
              </div>
              <div className="bg-dark-800 rounded-xl p-3">
                <p className="text-xs text-dark-400">Transactions</p>
                <p className="text-lg font-semibold text-white mt-1">{cashUp.transactions}</p>
              </div>
              <div className="bg-dark-800 rounded-xl p-3">
                <p className="text-xs text-dark-400">Cash</p>
                <p className="text-lg font-semibold text-gold-400 mt-1">
                  {money(cashUp.payments.find((p) => p.method === "cash")?.amount ?? 0)}
                </p>
              </div>
              <div className="bg-dark-800 rounded-xl p-3">
                <p className="text-xs text-dark-400">Card</p>
                <p className="text-lg font-semibold text-cyan-400 mt-1">
                  {money(cashUp.payments.find((p) => p.method === "card")?.amount ?? 0)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Payments</h4>
                {cashUp.payments.length ? (
                  <div className="space-y-2">
                    {cashUp.payments.map((p) => (
                      <div key={p.method} className="flex items-center justify-between bg-dark-800 rounded-xl px-4 py-3">
                        <span className="text-sm text-dark-300 capitalize">{p.method}</span>
                        <span className="text-sm font-semibold text-white">{money(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-dark-500">No payments recorded.</p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Products Sold</h4>
                {cashUp.productsSold.length ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {cashUp.productsSold.map((p) => (
                      <div key={p.productId} className="flex items-center justify-between bg-dark-800 rounded-xl px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{p.name}</p>
                          <p className="text-xs text-dark-400">{p.quantity} units</p>
                        </div>
                        <span className="text-sm font-semibold text-gold-400 ml-3">{money(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-dark-500">No products sold.</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-white mb-1">Cashier Reconciliation</h4>
              <p className="text-xs text-dark-400 mb-3">Sales and payment totals by staff member</p>
              {cashUp.cashierBreakdown.length ? (
                <div className="rounded-xl border border-dark-700 overflow-hidden overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-dark-800">
                      <tr className="text-left text-xs text-dark-400">
                        <th className="px-4 py-3 font-medium">Staff</th>
                        <th className="px-4 py-3 font-medium">Txns</th>
                        <th className="px-4 py-3 font-medium">Revenue</th>
                        <th className="px-4 py-3 font-medium">Cash</th>
                        <th className="px-4 py-3 font-medium">Card</th>
                        <th className="px-4 py-3 font-medium">Other</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700">
                      {cashUp.cashierBreakdown.map((c) => (
                        <tr key={c.userId} className="bg-dark-900 hover:bg-dark-800/70">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-white">{c.name}</p>
                            <p className="text-xs text-dark-500 capitalize">{c.role}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-dark-300">{c.transactions}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-400">{money(c.revenue)}</td>
                          <td className="px-4 py-3 text-sm text-gold-400">{money(c.cash)}</td>
                          <td className="px-4 py-3 text-sm text-cyan-400">{money(c.card)}</td>
                          <td className="px-4 py-3 text-sm text-dark-300">{money(c.other)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-dark-500">No sales recorded for this day.</p>
              )}
            </div>
          </>
        )}

        {!cashUpLoading && !cashUp && (
          <p className="text-sm text-dark-500">No cash-up data available for this date.</p>
        )}
      </div>

      <Modal
        open={!!editTarget && !!editKind}
        onClose={() => {
          setEditTarget(null);
          setEditKind(null);
        }}
        title={editTitle}
      >
        <div className="space-y-4">
          <Field
            label={editKind === "fullName" ? "Full name" : editKind === "displayName" ? "Display name" : "New password"}
          >
            <input
              type={editKind === "password" ? "password" : "text"}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </Field>
          <button
            onClick={saveEdit}
            disabled={editSaving}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 gold-gradient text-dark-950 font-semibold rounded-xl disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {editSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
