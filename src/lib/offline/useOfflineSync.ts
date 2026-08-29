"use client";

import { useCallback, useEffect, useState } from "react";
import { useOnlineStatus } from "./network";
import { pendingCount } from "./db";
import { syncOfflineQueue } from "./sync";

export function useOfflineSync() {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    setPending(await pendingCount());
  }, []);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncOfflineQueue();
    } finally {
      setSyncing(false);
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Auto-sync the moment connectivity comes back.
  useEffect(() => {
    if (online) runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return { online, pending, syncing, runSync, refreshPendingCount };
}
