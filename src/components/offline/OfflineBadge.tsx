"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflineBadge({
  online,
  pending,
  syncing,
}: {
  online: boolean;
  pending: number;
  syncing: boolean;
}) {
  if (online && pending === 0 && !syncing) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
        !online
          ? "bg-orange-400/10 text-orange-300 border border-orange-400/20"
          : "bg-cyan-400/10 text-cyan-300 border border-cyan-400/20"
      }`}
    >
      {!online ? (
        <>
          <WifiOff className="w-4 h-4" />
          Offline — {pending > 0 ? `${pending} item${pending === 1 ? "" : "s"} queued` : "changes will be queued"}
        </>
      ) : (
        <>
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : `${pending} item${pending === 1 ? "" : "s"} waiting to sync`}
        </>
      )}
    </div>
  );
}
