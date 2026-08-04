import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useEffect } from "react";

/**
 * Feature 11 — scanner feedback: a short success beep (Web Audio, no audio
 * file needed) and a vibration pulse on devices that support it (Android
 * via Capacitor's WebView, or any browser exposing navigator.vibrate).
 */
export function playScanBeep() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1568; // a bright, short "beep"
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not available — non-fatal */
  }
}

export async function vibrateSuccess() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(80);
    }
  } catch {
    /* vibration not available */
  }
}

export async function scanFeedback() {
  playScanBeep();
  await vibrateSuccess();
}

/**
 * Debounces repeat scans of the *same* code within `windowMs` (default
 * 1000ms), so holding a barcode in front of the camera doesn't spam-add
 * it. Returns true if this scan should be processed.
 */
export function createScanDebouncer(windowMs = 1000) {
  let lastCode = "";
  let lastAt = 0;
  return (code: string) => {
    const now = Date.now();
    if (code === lastCode && now - lastAt < windowMs) {
      return false;
    }
    lastCode = code;
    lastAt = now;
    return true;
  };
}

/**
 * Retail Supermarket Scanner Tracker (Milestone 2 Requirement).
 * Ensures that holding a barcode in front of the camera scans ONCE,
 * ignores duplicate scans while the barcode remains visible in frame,
 * and automatically resets once the barcode is removed from view.
 *
 * Requirements fulfilled:
 * Scan -> Beep -> Native Android vibration -> Highlight product ->
 * Ignore duplicate while barcode remains visible -> Automatically ready for next barcode.
 */
export function createRetailScanTracker(visibilityWindowMs = 700) {
  let activeCode: string | null = null;
  let lastSeenAt = 0;

  return {
    canScan: (code: string): boolean => {
      const now = Date.now();
      if (!code) {
        return false;
      }
      if (activeCode === code && now - lastSeenAt < visibilityWindowMs) {
        // Barcode is still visible in frame — refresh lastSeenAt and ignore duplicate!
        lastSeenAt = now;
        return false;
      }
      // Either a new barcode or previous barcode left view for >= visibilityWindowMs
      activeCode = code;
      lastSeenAt = now;
      return true;
    },
    reset: () => {
      activeCode = null;
      lastSeenAt = 0;
    },
  };
}

/**
 * Listens for physical USB / Bluetooth barcode hardware scanners.
 * Hardware scanners type characters very quickly (< 80ms interval) and terminate with Enter.
 */
export function useHardwareScanner(
  onScan: (barcode: string) => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let buffer = "";
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 80) {
        buffer = "";
      }
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (buffer.trim().length >= 3) {
          e.preventDefault();
          onScan(buffer.trim());
        }
        buffer = "";
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, enabled]);
}
