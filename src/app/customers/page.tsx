"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Plus, Users, Phone, Mail, Award, Receipt, AlertCircle, FileText } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { Field, inputClass, textareaClass } from "@/components/ui/Field";
import { money, formatDate } from "@/lib/format";

import jsPDF from "jspdf";


interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes?: string | null;
  loyaltyPoints: number;
  outstandingBalance?: string | number;
}

interface CustomerDetail extends Customer {
  history: { id: number; receiptNumber: string; total: string; createdAt: string }[];
  totalSpent: number;
  visits: number;
}

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };

const membershipLevel=(points:number): { name: string; tone: "success" | "warning" | "neutral" } =>{
  if(points>=1000) return {name:"Platinum",tone:"success"};
  if(points>=500) return {name:"Gold",tone:"warning"};
  if(points>=250) return {name:"Silver",tone:"neutral"};
  return {name:"Bronze",tone:"neutral"};
};


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

  const exportCustomerStatement = (printAfter = false) => {
    if (!detail) return;

    const pdf = new jsPDF("p","mm","a4");

    let y = 18;

    pdf.setFillColor(20,20,20);
    pdf.rect(0,0,210,28,"F");

    pdf.setTextColor(212,175,55);
    pdf.setFont("helvetica","bold");
    pdf.setFontSize(20);
    pdf.text("GOD'S EMPIRE POS",105,12,{align:"center"});

    pdf.setTextColor(255,255,255);
    pdf.setFontSize(10);
    pdf.text("CUSTOMER STATEMENT",105,20,{align:"center"});

    pdf.setTextColor(0,0,0);

    y=40;

    const level = membershipLevel(detail.loyaltyPoints);

    pdf.setFont("helvetica","bold");
    pdf.setFontSize(13);
    pdf.text("CUSTOMER DETAILS",20,y);

    y+=6;

    pdf.roundedRect(15,y,180,52,3,3);

    y+=8;

    pdf.setFont("helvetica","normal");
    pdf.setFontSize(11);

    pdf.text("Name",22,y);
    pdf.text(detail.name,70,y);
    y+=8;

    if(detail.phone){
      pdf.text("Phone",22,y);
      pdf.text(detail.phone,70,y);
      y+=8;
    }

    if(detail.email){
      pdf.text("Email",22,y);
      pdf.text(detail.email,70,y);
      y+=8;
    }

    pdf.text("Membership",22,y);

    if(level.name==="Bronze"){
      pdf.setFillColor(140,90,40);
    }else if(level.name==="Silver"){
      pdf.setFillColor(170,170,170);
    }else if(level.name==="Gold"){
      pdf.setFillColor(212,175,55);
    }else{
      pdf.setFillColor(60,120,255);
    }

    pdf.roundedRect(70,y-5,28,7,2,2,"F");

    pdf.setTextColor(255,255,255);
    pdf.setFont("helvetica","bold");
    pdf.setFontSize(9);
    pdf.text(level.name,84,y,{align:"center"});

    pdf.setTextColor(0,0,0);
    pdf.setFont("helvetica","normal");
    pdf.setFontSize(11);

    y+=8;

    pdf.text("Loyalty Points",22,y);
    pdf.text(String(detail.loyaltyPoints),70,y);
    y+=8;

    pdf.text("Visits",22,y);
    pdf.text(String(detail.visits),70,y);
    y+=8;

    pdf.text("Total Spent",110,y-16);
    pdf.text(money(detail.totalSpent),155,y-16);

    pdf.text("Outstanding",110,y-8);
    pdf.text(money(detail.outstandingBalance||0),155,y-8);

    y+=10;

    pdf.setFont("helvetica","bold");
    pdf.setFontSize(13);
    pdf.text("Purchase History",20,y);

    y+=8;

    pdf.setFont("helvetica","normal");
    pdf.setFontSize(10);

    pdf.setFont("helvetica","bold");
    pdf.setFontSize(10);

    pdf.text("Receipt",20,y);
    pdf.text("Date",95,y);
    pdf.text("Total",170,y);

    y += 4;
    pdf.line(20,y,190,y);

    y += 6;

    pdf.setFont("helvetica","normal");

    detail.history.forEach((sale)=>{

      pdf.text(sale.receiptNumber,20,y);
      pdf.text(formatDate(sale.createdAt),95,y);
      pdf.text(money(sale.total),170,y);

      y += 7;

      if(y>280){
        pdf.addPage();

        y=20;

        pdf.setFont("helvetica","bold");
        pdf.setFontSize(10);

        pdf.text("Receipt",20,y);
        pdf.text("Date",95,y);
        pdf.text("Total",170,y);

        y += 4;
        pdf.line(20,y,190,y);

        y += 6;

        pdf.setFont("helvetica","normal");
      }

    });

    y+=10;

    pdf.setDrawColor(180);
    pdf.line(15,y,195,y);

    y += 8;

    pdf.setFontSize(9);

    pdf.text(
      `Generated: ${new Date().toLocaleString("en-ZA")}`,
      20,
      y
    );

    pdf.text(
      "Powered by K&K Tech Solutions",
      105,
      287,
      {align:"center"}
    );

    pdf.text(
      "www.kandktechsolutions.co.za",
      105,
      292,
      {align:"center"}
    );

    if(printAfter){
      const blob=pdf.output("blob");
      const url=URL.createObjectURL(blob);
      const win=window.open(url,"_blank");
      if(win){
        win.onload=()=>win.print();
      }
    }else{
      pdf.save(
        `Customer_${detail.name.replace(/\s+/g,"_")}.pdf`
      );
    }
  };

  return (

    <div className="animate-fadeIn space-y-5">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} registered customer${customers.length === 1 ? "" : "s"}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/customers/outstanding"
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold text-sm rounded-xl transition-colors"
            >
              <Receipt className="w-4 h-4" /> Outstanding Balances
            </Link>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" /> Add Customer
            </button>
          </div>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search by name or phone..." />

      {!loading && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-dark-400">Customers</p>
          <p className="text-2xl font-bold text-white mt-2">{customers.length}</p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-dark-400">Debtors</p>
          <p className="text-2xl font-bold text-red-400 mt-2">
            {customers.filter(c=>Number(c.outstandingBalance||0)>0).length}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-dark-400">Outstanding</p>
          <p className="text-2xl font-bold text-gold-400 mt-2">
            {money(customers.reduce((a,c)=>a+Number(c.outstandingBalance||0),0))}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-dark-400">Loyalty Points</p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            {customers.reduce((a,c)=>a+c.loyaltyPoints,0)}
          </p>
        </div>

      </div>
      )}

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
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white truncate">{c.name}</p>
                  <p className="text-xs text-dark-400 truncate">{c.phone ?? "No phone"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-dark-800">
                <span className="text-xs text-dark-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> {c.loyaltyPoints} pts
                </span>
                {Number(c.outstandingBalance || 0) > 0 ? (
                  <Badge tone="danger">Owes {money(c.outstandingBalance || 0)}</Badge>
                ) : (
                  <Badge tone="neutral">Settled</Badge>
                )}
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
          <Field label="Notes / Profile Remarks">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="VIP status, store credit, preferences, etc."
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
        title=""
      >
        {loadingDetail || !detail ? (
          <Spinner />
        ) : (
          <div className="space-y-5">

<div className="flex items-center gap-4 border-b border-dark-800 pb-5">

<div className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center text-3xl font-bold text-dark-950">
{detail.name.charAt(0).toUpperCase()}
</div>

<div className="flex-1">

<h2 className="text-2xl font-bold text-white">
{detail.name}
</h2>

<div className="mt-2">
<Badge tone={membershipLevel(detail.loyaltyPoints).tone}>
{membershipLevel(detail.loyaltyPoints).name} Member
</Badge>
</div>

</div>

</div>
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
                <div className="flex flex-col items-center mt-1">
<p className="text-sm font-bold text-green-400">{detail.loyaltyPoints}</p>
<Badge tone={membershipLevel(detail.loyaltyPoints).tone}>
  {membershipLevel(detail.loyaltyPoints).name}
</Badge>
</div>
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

            {Number(detail.outstandingBalance || 0) > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-300">Outstanding Account Balance</p>
                  <p className="text-lg font-bold text-red-500">{money(detail.outstandingBalance || 0)}</p>
                </div>
                <Link
                  href="/customers/outstanding"
                  className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold text-xs rounded-lg transition-colors"
                >
                  Settle Debt
                </Link>
              </div>
            )}

            {detail.notes && (
              <div className="bg-dark-900 rounded-xl p-3">
                <p className="text-xs text-dark-400 flex items-center gap-1.5 mb-1">
                  <FileText className="w-3.5 h-3.5" /> Notes
                </p>
                <p className="text-sm text-dark-200">{detail.notes}</p>
              </div>
            )}

            <div className="flex gap-2 mb-4">

              <button
                onClick={()=>exportCustomerStatement(true)}
                className="flex-1 py-2.5 bg-dark-800 hover:bg-dark-700 rounded-xl text-white text-sm font-semibold transition-colors"
              >
                🖨 Print Statement
              </button>

              <button
                onClick={()=>exportCustomerStatement(false)}
                className="flex-1 py-2.5 gold-gradient text-dark-950 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                📄 Export PDF
              </button>

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
