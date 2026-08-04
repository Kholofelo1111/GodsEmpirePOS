"use client";

import { useState, useEffect } from "react";
import { Save, Building2, Receipt, Bell, Database, CheckCircle, Crown } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Spinner from "@/components/ui/Spinner";
import { Field, inputClass, textareaClass } from "@/components/ui/Field";
import type { BusinessInfo } from "@/lib/queries";

type Tab = "business" | "receipt" | "notifications" | "data";

const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: "business", label: "Business", icon: Building2 },
  { id: "receipt", label: "Receipt", icon: Receipt },
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "data", label: "Data", icon: Database },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("business");
  const [form, setForm] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [alerts, setAlerts] = useState({ low: true, out: true, summary: true });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setForm)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <Spinner label="Loading settings..." />;

  const update = (patch: Partial<BusinessInfo>) => setForm({ ...form, ...patch });

  return (
    <div className="animate-fadeIn space-y-5">
      <PageHeader title="Settings" subtitle="Business details, receipts and alerts" />

      {saved && (
        <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/30 rounded-xl p-4 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" /> Settings saved successfully.
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id
                ? "gold-gradient text-dark-950"
                : "bg-dark-800 text-dark-300 hover:text-white"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-5 md:p-6">
        {tab === "business" && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Business Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Shop name" required className="md:col-span-2">
                <input
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={(e) => update({ phone: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update({ email: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Address" className="md:col-span-2">
                <textarea
                  value={form.address}
                  onChange={(e) => update({ address: e.target.value })}
                  rows={2}
                  className={textareaClass}
                />
              </Field>
              <Field label="Currency">
                <input value="South African Rand (ZAR)" disabled className={`${inputClass} opacity-60`} />
              </Field>
              <Field label="VAT rate (%)" hint="Applied to sales when VAT is enabled at the till.">
                <input
                  type="number"
                  value={form.vatRate}
                  onChange={(e) => update({ vatRate: Number(e.target.value) })}
                  min="0"
                  max="100"
                  step="0.5"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        )}

        {tab === "receipt" && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Receipt Customisation</h2>
            <Field label="Logo URL" hint="Optional. A hosted image URL — shown at the top of printed receipts.">
              <input
                value={form.logoUrl ?? ""}
                onChange={(e) => update({ logoUrl: e.target.value })}
                className={inputClass}
                placeholder="https://example.com/logo.png"
              />
            </Field>
            <Field label="Footer message">
              <textarea
                value={form.receiptFooter}
                onChange={(e) => update({ receiptFooter: e.target.value })}
                rows={2}
                className={textareaClass}
              />
            </Field>

            <div>
              <p className="text-sm text-dark-400 mb-2">Live preview</p>
              <div className="bg-white text-black rounded-xl p-5 font-mono text-[12px] max-w-xs">
                <div className="text-center">
                  <Crown className="w-5 h-5 mx-auto mb-1" />
                  <p className="font-bold text-sm">{form.name}</p>
                  <p className="text-[10px] leading-tight">{form.address}</p>
                  <p className="text-[10px]">{form.phone}</p>
                </div>
                <div className="border-t border-dashed border-black/40 my-2 py-2 text-[10px]">
                  <div className="flex justify-between">
                    <span>1 × Sample item</span>
                    <span>R100.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT ({form.vatRate}%)</span>
                    <span>R{((100 * form.vatRate) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-black/30 mt-1 pt-1">
                    <span>TOTAL</span>
                    <span>R{(100 + (100 * form.vatRate) / 100).toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-center text-[10px]">{form.receiptFooter}</p>
              </div>
            </div>
          </div>
        )}

        {tab === "notifications" && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Notification Preferences</h2>
            {[
              { key: "low" as const, title: "Low stock alerts", desc: "Warn when items reach their minimum level" },
              { key: "out" as const, title: "Out of stock alerts", desc: "Warn as soon as an item hits zero" },
              { key: "summary" as const, title: "Daily sales summary", desc: "End-of-day totals on the dashboard" },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-4 p-4 bg-dark-900 rounded-xl border border-dark-700 cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-dark-400 mt-0.5">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={alerts[item.key]}
                  onChange={(e) => setAlerts({ ...alerts, [item.key]: e.target.checked })}
                  className="w-5 h-5 rounded accent-gold-400 flex-shrink-0"
                />
              </label>
            ))}
          </div>
        )}

        {(tab === "business" || tab === "receipt") && (
          <div className="mt-6 pt-5 border-t border-dark-800">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
