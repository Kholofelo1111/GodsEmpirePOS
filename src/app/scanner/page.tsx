"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Camera, CameraOff, Package, Plus, ScanLine, Search, ShoppingCart } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { Field, inputClass } from "@/components/ui/Field";
import { money, stockStatus } from "@/lib/format";

interface Product {
  id: number;
  name: string;
  barcode: string | null;
  sellingPrice: string;
  costPrice: string;
  stock: number;
  minStockLevel: number;
  categoryName?: string | null;
}

// BarcodeDetector is not in the TS DOM lib yet.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<Product | null>(null);
  const [missingBarcode, setMissingBarcode] = useState("");
  const [searching, setSearching] = useState(false);

  const lookup = useCallback(async (barcode: string) => {
    const code = barcode.trim();
    if (!code) return;
    setSearching(true);
    setResult(null);
    setMissingBarcode("");

    try {
      const products: Product[] = await fetch(
        `/api/products?barcode=${encodeURIComponent(code)}`
      ).then((r) => r.json());
      const found = Array.isArray(products) ? products[0] : null;

      if (found) {
        setResult(found);
        if (navigator.vibrate) navigator.vibrate(60);
      } else {
        setMissingBarcode(code);
      }
    } catch {
      setMissingBarcode(code);
    } finally {
      setSearching(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;

      if (!Detector) {
        setCameraError(
          "Live decoding isn't supported by this browser — use a hardware scanner or type the barcode below."
        );
        return;
      }

      const detector = new Detector({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
      });

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const value = codes[0].rawValue;
            stopCamera();
            setManual(value);
            lookup(value);
            return;
          }
        } catch {
          /* frame not ready — keep scanning */
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError("Camera access denied. Allow camera permission or enter the barcode manually.");
      setScanning(false);
    }
  }, [lookup, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const status = result ? stockStatus(result.stock, result.minStockLevel) : null;

  return (
    <div className="animate-fadeIn space-y-5">
      <PageHeader title="Barcode Scanner" subtitle="Scan with the camera or enter a code manually" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <section className="glass-card rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Camera</h2>

          <div className="relative aspect-square bg-dark-900 rounded-xl overflow-hidden mb-4">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${scanning ? "" : "hidden"}`}
            />

            {scanning && (
              <>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-40 border-2 border-gold-400 rounded-xl animate-pulse-gold" />
                </div>
                <p className="absolute bottom-3 inset-x-0 text-center text-xs text-white/80">
                  Hold the barcode inside the frame
                </p>
              </>
            )}

            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                <Camera className="w-14 h-14 text-dark-600 mb-4" />
                <p className="text-dark-400 text-sm text-center mb-5">
                  Use your phone camera to scan product barcodes
                </p>
                <button
                  onClick={startCamera}
                  className="px-6 py-3 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  Start Camera
                </button>
              </div>
            )}
          </div>

          {scanning && (
            <button
              onClick={stopCamera}
              className="w-full flex items-center justify-center gap-2 py-3 bg-dark-800 text-dark-200 rounded-xl hover:bg-dark-700 transition-colors"
            >
              <CameraOff className="w-4 h-4" /> Stop Camera
            </button>
          )}

          {cameraError && (
            <p className="mt-3 text-xs text-orange-300 bg-orange-400/10 border border-orange-400/20 rounded-lg p-3">
              {cameraError}
            </p>
          )}
        </section>

        <div className="space-y-4">
          <section className="glass-card rounded-2xl p-5 md:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Manual Entry</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookup(manual);
              }}
              className="space-y-3"
            >
              <Field label="Barcode number">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400 pointer-events-none" />
                  <input
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    placeholder="6001001000015"
                    className={`${inputClass} pl-12 font-mono`}
                  />
                </div>
              </Field>
              <button
                type="submit"
                disabled={searching || !manual.trim()}
                className="w-full py-3 gold-gradient text-dark-950 font-semibold rounded-xl disabled:opacity-40"
              >
                {searching ? "Searching..." : "Look Up Product"}
              </button>
            </form>
          </section>

          {result && status && (
            <section className="glass-card rounded-2xl p-5 md:p-6 animate-slideUp">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-400/10 flex items-center justify-center">
                  <Package className="w-4 h-4 text-green-400" />
                </div>
                <h3 className="text-base font-semibold text-white">Product Found</h3>
              </div>

              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl bg-dark-800 flex items-center justify-center flex-shrink-0">
                  <Package className="w-7 h-7 text-dark-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{result.name}</p>
                  <p className="text-xl font-bold text-gold-400 mt-0.5">
                    {money(result.sellingPrice)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge tone={status.tone}>{result.stock} in stock</Badge>
                    <span className="text-xs text-dark-400 font-mono">{result.barcode}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/pos?barcode=${encodeURIComponent(result.barcode ?? "")}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 gold-gradient text-dark-950 text-sm font-semibold rounded-xl"
                >
                  <ShoppingCart className="w-4 h-4" /> Sell
                </Link>
                <Link
                  href={`/products/${result.id}/edit`}
                  className="flex-1 py-2.5 bg-dark-800 text-dark-200 text-sm font-medium rounded-xl text-center hover:bg-dark-700 transition-colors"
                >
                  Edit
                </Link>
              </div>
            </section>
          )}

          {missingBarcode && (
            <section className="glass-card rounded-2xl p-5 md:p-6 animate-slideUp">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-orange-400/10 flex items-center justify-center">
                  <ScanLine className="w-4 h-4 text-orange-400" />
                </div>
                <h3 className="text-base font-semibold text-white">Not in catalogue</h3>
              </div>
              <p className="text-sm text-dark-400 mb-4">
                No product uses barcode{" "}
                <span className="font-mono text-white">{missingBarcode}</span>.
              </p>
              <Link
                href={`/products/new?barcode=${encodeURIComponent(missingBarcode)}`}
                className="w-full flex items-center justify-center gap-2 py-3 gold-gradient text-dark-950 font-semibold rounded-xl"
              >
                <Plus className="w-5 h-5" /> Create Product
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
