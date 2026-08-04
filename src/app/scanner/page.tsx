"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Camera, CameraOff, Package, Plus, ScanLine, Search, ShoppingCart } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { Field, inputClass } from "@/components/ui/Field";
import { money, stockStatus } from "@/lib/format";
import { scanFeedback, createRetailScanTracker, useHardwareScanner } from "@/lib/scanFeedback";

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

const CAMERA_PREF_KEY = "ge-pos-preferred-camera";

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const trackerRef = useRef(createRetailScanTracker(800));

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<Product | null>(null);
  const [highlighted, setHighlighted] = useState(false);
  const [missingBarcode, setMissingBarcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>("");

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
        setHighlighted(true);
        setTimeout(() => setHighlighted(false), 1500);
        scanFeedback();
      } else {
        setMissingBarcode(code);
      }
    } catch {
      setMissingBarcode(code);
    } finally {
      setSearching(false);
    }
  }, []);

  useHardwareScanner(lookup, true);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const runDetectionLoop = useCallback(() => {
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
          if (trackerRef.current.canScan(value)) {
            setManual(value);
            lookup(value);
          }
        }
      } catch {
        /* frame not ready — keep scanning */
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [lookup]);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      setCameraError("");
      try {
        const preferred = deviceId || localStorage.getItem(CAMERA_PREF_KEY) || "";
        const constraints: MediaStreamConstraints = {
          video: preferred
            ? { deviceId: { exact: preferred } }
            : { facingMode: { ideal: "environment" } },
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          // Saved/requested device may no longer exist — fall back to default.
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
          });
        }

        streamRef.current = stream;
        setScanning(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? "";
        if (activeDeviceId) {
          setActiveCameraId(activeDeviceId);
          localStorage.setItem(CAMERA_PREF_KEY, activeDeviceId);
        }

        // Camera labels are only populated once permission has been granted,
        // so enumerate here rather than on page load.
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((d) => d.kind === "videoinput"));

        runDetectionLoop();
      } catch {
        setCameraError("Camera access denied. Allow camera permission or enter the barcode manually.");
        setScanning(false);
      }
    },
    [runDetectionLoop]
  );

  const switchCamera = useCallback(
    async (deviceId: string) => {
      stopCamera();
      await startCamera(deviceId);
    },
    [stopCamera, startCamera]
  );

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
                  onClick={() => startCamera()}
                  className="px-6 py-3 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  Start Camera
                </button>
              </div>
            )}
          </div>

          {scanning && (
            <div className="space-y-2 mb-2">
              {cameras.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {cameras.map((cam, idx) => {
                    const label = cam.label || (idx === 0 ? "Camera 1" : `Camera ${idx + 1}`);
                    const friendly = /front|user|face/i.test(cam.label)
                      ? "Front Camera"
                      : /back|rear|environment/i.test(cam.label)
                      ? "Rear Camera"
                      : label;
                    return (
                      <button
                        key={cam.deviceId}
                        onClick={() => switchCamera(cam.deviceId)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          activeCameraId === cam.deviceId
                            ? "bg-gold-400/20 text-gold-400 border border-gold-400/40"
                            : "bg-dark-800 text-dark-300 hover:bg-dark-700"
                        }`}
                      >
                        {friendly}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                onClick={stopCamera}
                className="w-full flex items-center justify-center gap-2 py-3 bg-dark-800 text-dark-200 rounded-xl hover:bg-dark-700 transition-colors"
              >
                <CameraOff className="w-4 h-4" /> Stop Camera
              </button>
            </div>
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
            <section
              className={`glass-card rounded-2xl p-5 md:p-6 animate-slideUp transition-all duration-300 ${
                highlighted
                  ? "ring-2 ring-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/20"
                  : ""
              }`}
            >
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
                href={`/products/new?barcode=${encodeURIComponent(missingBarcode)}&return=/scanner`}
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
