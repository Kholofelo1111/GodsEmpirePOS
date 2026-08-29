"use client";

import { useEffect, useState } from "react";

/**
 * Tracks browser/WebView connectivity. navigator.onLine is a reasonable,
 * zero-dependency signal for "is there a network interface up" — it can't
 * guarantee the server itself is reachable, so actual fetch() calls should
 * still fall back to queueing on failure even if this reports "online".
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
