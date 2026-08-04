import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Bell } from "lucide-react";

export default async function NotificationsPage() {
  const alerts = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="w-7 h-7 text-gold-400" />
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
      </div>

      {alerts.length === 0 ? (
        <div className="glass-card rounded-2xl p-6 text-dark-400">
          No notifications yet.
        </div>
      ) : (
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
