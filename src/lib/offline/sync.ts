"use client";

import {
  getPendingSales,
  removePendingSale,
  getPendingStockAdjustments,
  removePendingStockAdjustment,
} from "./db";

export interface SyncResult {
  salesSynced: number;
  adjustmentsSynced: number;
  failed: number;
}

let syncing = false;

/**
 * Replays queued offline writes against the real API, in the order they
 * were queued. Each item is only removed from the local queue once the
 * server has actually accepted it — if a request fails (still offline, or
 * a genuine server error), it stays queued and is retried on the next
 * sync attempt rather than being silently dropped.
 *
 * Single-device scope: this does not attempt to detect or resolve
 * conflicts with sales/adjustments made on other devices in the meantime.
 */
export async function syncOfflineQueue(): Promise<SyncResult> {
  if (syncing) return { salesSynced: 0, adjustmentsSynced: 0, failed: 0 };
  syncing = true;

  const result: SyncResult = { salesSynced: 0, adjustmentsSynced: 0, failed: 0 };

  try {
    const pendingSales = await getPendingSales();
    for (const sale of pendingSales) {
      try {
        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sale.payload),
        });
        if (!res.ok) throw new Error(`Sale sync failed (${res.status})`);
        await removePendingSale(sale.localId);
        result.salesSynced++;
      } catch (err) {
        console.warn("Offline sale still pending sync:", sale.localId, err);
        result.failed++;
      }
    }

    const pendingAdjustments = await getPendingStockAdjustments();
    for (const adj of pendingAdjustments) {
      try {
        const res = await fetch("/api/inventory/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(adj.payload),
        });
        if (!res.ok) throw new Error(`Stock adjustment sync failed (${res.status})`);
        await removePendingStockAdjustment(adj.localId);
        result.adjustmentsSynced++;
      } catch (err) {
        console.warn("Offline stock adjustment still pending sync:", adj.localId, err);
        result.failed++;
      }
    }
  } finally {
    syncing = false;
  }

  return result;
}
