"use client";

import { useRouter } from "next/navigation";

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

  return (
    <div
      onClick={markRead}
      className={`glass-card rounded-2xl p-4 cursor-pointer transition ${
        alert.isRead ? "opacity-60" : "hover:border-gold-400/40"
      }`}
    >
      <h2 className="font-semibold text-white">{alert.title}</h2>

      <p className="text-dark-300 mt-1">{alert.message}</p>

      <p className="text-xs text-dark-500 mt-3">
        {new Date(alert.createdAt).toLocaleString("en-ZA")}
      </p>
    </div>
  );
}
