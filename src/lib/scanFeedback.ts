import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
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
