"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BarcodeScanner as MlkitBarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import Modal from "@/components/ui/Modal";
import { playScanBeep, vibrateSuccess } from "@/lib/scanFeedback";

/**
 * Shared barcode scanner, reused across invoice creation and stock
 * wastage/removal (in addition to the scanning already built into the POS
 * screen). Behaviour is copied from the existing, already-working POS
 * scanner (native ML Kit scan loop on Android; getUserMedia + the
 * browser's BarcodeDetector API on web) so every workflow scans the same
 * way — this does not change or replace that existing POS implementation.
 *
 * On native, ML Kit opens its own OS-level camera UI outside the webview,
 * so there is nothing to render there — the component just drives the
 * scan loop. On web, it renders a small video-preview modal.
 */

type BarcodeDetectorCtor = new (options: { formats: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  /** Optional helper text shown under the video preview (web only). */
  hint?: string;
};

export default function BarcodeScanner({ open, onClose, onScan, title = "Scan Barcode", hint }: Props) {
  const [scannerError, setScannerError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopWeb = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleDetected = useCallback(
    (code: string) => {
      if (!code) return;
      playScanBeep();
      vibrateSuccess();
      onScan(code);
    },
    [onScan]
  );

  const startWeb = useCallback(async () => {
    setScannerError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Detector) {
        setScannerError("Live scanning isn't supported by this browser. Use search instead.");
        return;
      }
      const detector = new Detector({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
      });

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) handleDetected(codes[0].rawValue);
        } catch {
          /* frame not ready — keep scanning */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setScannerError("Camera access denied. Allow camera permission to scan, or search instead.");
    }
  }, [handleDetected]);

  const startNative = useCallback(async () => {
    try {
      const { available } = await MlkitBarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await MlkitBarcodeScanner.installGoogleBarcodeScannerModule();
        await new Promise<void>((resolve) => {
          MlkitBarcodeScanner.addListener("googleBarcodeScannerModuleInstallProgress", (event) => {
            if (event.state === 4) resolve();
          });
        });
      }

      // Scan continuously: ML Kit's scan() returns after each detection, so
      // re-open it immediately, same as the POS scanner — lets the user
      // scan several items in a row without re-tapping "Scan" each time.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { barcodes } = await MlkitBarcodeScanner.scan();
        if (!barcodes.length) break;
        const code = barcodes[0].rawValue ?? "";
        if (!code) break;
        handleDetected(code);
      }
    } catch (e) {
      console.error(e);
      // A cancelled scan also lands here — expected, not an error to surface.
    } finally {
      onClose();
    }
  }, [handleDetected, onClose]);

  useEffect(() => {
    if (!open) return;
    setScannerError("");
    if (Capacitor.isNativePlatform()) {
      startNative();
    } else {
      startWeb();
    }
    return () => {
      stopWeb();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (Capacitor.isNativePlatform()) {
    // Native scanning uses ML Kit's own full-screen camera UI; no modal needed.
    return null;
  }

  const close = () => {
    stopWeb();
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={title}>
      <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black" />
      {hint && <p className="mt-3 text-center text-sm text-dark-300">{hint}</p>}
      {scannerError && <p className="mt-2 text-sm text-orange-300 text-center">{scannerError}</p>}
      <button onClick={close} className="w-full mt-4 py-3 bg-red-600 text-white rounded-xl">
        Close Scanner
      </button>
    </Modal>
  );
}
