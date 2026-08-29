"use client";

import { useState, useEffect } from "react";
import { Bell, AlertCircle } from "lucide-react";
import Spinner from "@/components/ui/Spinner";

export default function NotificationsPage() {
  const [alerts, setAlerts] = useState<any[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setAlerts)
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="w-7 h-7 text-gold-400" />
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
      </div>

      {failed && (
        <div className="glass-card rounded-2xl p-6 flex items-center gap-3 text-orange-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          Internet connection required to load notifications.
        </div>
      )}

      {!failed && !alerts && (
        <div className="py-12">
          <Spinner label="Loading notifications..." />
        </div>
      )}

      {!failed && alerts && alerts.length === 0 && (
        <div className="glass-card rounded-2xl p-6 text-dark-400">
          No notifications yet.
        </div>
      )}

      {!failed && alerts && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="glass-card rounded-2xl p-4"
            >
              <h2 className="font-semibold text-white">
                {alert.title}
              </h2>

              <p className="text-dark-300 mt-1">
                {alert.message}
              </p>

              <p className="text-xs text-dark-500 mt-3">
                {new Date(alert.createdAt).toLocaleString("en-ZA")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
