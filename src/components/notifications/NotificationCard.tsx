"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, PackageX, CreditCard, TrendingUp, CheckCircle, Bell } from "lucide-react";

export default function NotificationCard({ alert }: { alert: any }) {
  const router = useRouter();

  async function markRead() {
    if (!alert.isRead) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: alert.id }),
      });
    }

    router.refresh();
  }

  const iconMap: Record<string, { icon: React.ReactNode; toneBg: string; toneText: string }> = {
    low_stock: {
      icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
      toneBg: "bg-orange-400/10",
      toneText: "text-orange-400",
    },
    out_of_stock: {
      icon: <PackageX className="w-5 h-5 text-red-400" />,
      toneBg: "bg-red-400/10",
      toneText: "text-red-400",
    },
    outstanding_balance: {
      icon: <CreditCard className="w-5 h-5 text-red-400" />,
      toneBg: "bg-red-500/10",
      toneText: "text-red-400",
    },
    daily_summary: {
      icon: <TrendingUp className="w-5 h-5 text-green-400" />,
      toneBg: "bg-green-400/10",
      toneText: "text-green-400",
    },
  };

  const style = iconMap[alert.type] || {
    icon: <Bell className="w-5 h-5 text-gold-400" />,
    toneBg: "bg-gold-400/10",
    toneText: "text-gold-400",
  };

  return (
    <div
      onClick={markRead}
      className={`glass-card rounded-2xl p-5 cursor-pointer transition-all ${
        alert.isRead ? "opacity-60" : "border-l-4 border-l-gold-400 hover:border-gold-400/40"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.toneBg}`}>
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-white text-base">{alert.title}</h2>
            {!alert.isRead && (
              <span className="inline-flex items-center gap-1 text-xs text-gold-400 font-medium bg-gold-400/10 px-2 py-0.5 rounded-full">
                Unread
              </span>
            )}
          </div>
          <p className="text-dark-200 text-sm mt-1 leading-relaxed">{alert.message}</p>
          <p className="text-xs text-dark-400 mt-3 flex items-center gap-2">
            <span>{new Date(alert.createdAt).toLocaleString("en-ZA")}</span>
            {alert.isRead && (
              <span className="flex items-center gap-1 text-dark-400">
                · <CheckCircle className="w-3 h-3 text-green-400 inline" /> Read
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
