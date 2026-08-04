"use client";

import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { Capacitor } from "@capacitor/core";
import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { ArrowDownCircle, CheckCircle, Package, Search, ScanLine, Plus, Camera } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import { Field, inputClass, selectClass, textareaClass } from "@/components/ui/Field";
import { money, formatDateTime } from "@/lib/format";
import { scanFeedback, useHardwareScanner } from "@/lib/scanFeedback";

interface Product {
  id: number;
  name: string;
  barcode: string | null;
  stock: number;
  costPrice: string;
}

interface StockInRecord {
  id: number;
  productName: string | null;
  quantity: number;
  purchaseCost: string | null;
  createdAt: string;
  notes: string | null;
}

// BarcodeDetector typing for web
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function StockInContent() {
  const params = useSearchParams();
  const returnedBarcode = params.get("barcode");

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [history, setHistory] = useState<StockInRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [missingBarcode, setMissingBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Web camera modal state
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [p, s, h] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/suppliers").then((r) => r.json()),
        fetch("/api/stock-in").then((r) => r.json()),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setSuppliers(Array.isArray(s) ? s : []);
      setHistory(Array.isArray(h) ? h : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const choose = useCallback((p: Product) => {
    setSelected(p);
    setSearch(p.name);
    setPurchaseCost(p.costPrice);
    setMissingBarcode("");
  }, []);

  // When returning from creating a new product with ?barcode=..., auto-select it!
  useEffect(() => {
    if (returnedBarcode && products.length > 0 && !selected) {
      const found = products.find((x) => x.barcode === returnedBarcode);
      if (found) {
        choose(found);
        setTimeout(() => {
          quantityInputRef.current?.focus();
        }, 50);
      }
    }
  }, [returnedBarcode, products, selected, choose]);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || selected) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(term) || (p.barcode ?? "").includes(term))
      .slice(0, 6);
  }, [products, search, selected]);

  const stopWebScanner = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleScannedCode = useCallback(
    (code: string) => {
      const codeTrim = code.trim();
      if (!codeTrim) return;

      const product = products.find((p) => p.barcode === codeTrim || String(p.id) === codeTrim);
      if (product) {
        choose(product);
        scanFeedback();
        stopWebScanner();
        setShowScannerModal(false);
        setTimeout(() => {
          quantityInputRef.current?.focus();
        }, 100);
      } else {
        // Warehouse requirement: if product does not exist, offer Create Product
        setMissingBarcode(codeTrim);
        setSelected(null);
        stopWebScanner();
        setShowScannerModal(false);
      }
    },
    [products, choose, stopWebScanner]
  );

  useHardwareScanner(handleScannedCode, true);

  const startWebScanner = useCallback(async () => {
    setScannerError("");
    setShowScannerModal(true);
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
        setScannerError(
          "Live scanning isn't supported by this browser. Use physical barcode scanner or search box."
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
            handleScannedCode(codes[0].rawValue);
            return;
          }
        } catch {
          /* frame not ready — keep scanning */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setScannerError("Camera access denied. Allow camera permission or use physical scanner.");
    }
  }, [handleScannedCode]);

  const startScanner = async () => {
    if (!Capacitor.isNativePlatform()) {
      await startWebScanner();
      return;
    }

    try {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        await new Promise<void>((resolve) => {
          BarcodeScanner.addListener("googleBarcodeScannerModuleInstallProgress", (event) => {
            if (event.state === 4) resolve();
          });
        });
      }

      const { barcodes } = await BarcodeScanner.scan();
      if (!barcodes.length) return;

      const code = barcodes[0].rawValue ?? "";
      if (code) {
        handleScannedCode(code);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => () => stopWebScanner(), [stopWebScanner]);

  const reset = () => {
    setSelected(null);
    setSearch("");
    setQuantity("");
    setPurchaseCost("");
    setNotes("");
    setSupplierId("");
    setMissingBarcode("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !quantity) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/stock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id,
          supplierId: supplierId || null,
          quantity: Number(quantity),
          purchaseCost: purchaseCost || null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not record stock");
      }

      setSuccess(`Added ${quantity} × ${selected.name} — stock is now ${selected.stock + Number(quantity)}`);
      reset();
      load();
      setTimeout(() => setSuccess(""), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record stock");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading..." />;

  return (
    <div className="animate-fadeIn space-y-5">
      <PageHeader title="Stock In" subtitle="Receive deliveries and update inventory" />

      {success && (
        <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/30 rounded-xl p-4 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <form onSubmit={submit} className="glass-card rounded-2xl p-5 md:p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Receive Stock</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {missingBarcode && (
            <section className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 animate-slideUp">
              <div className="flex items-center gap-2 mb-2">
                <ScanLine className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-semibold text-white">Product Not in Catalogue</h3>
              </div>
              <p className="text-xs text-dark-300 mb-3">
                Barcode <span className="font-mono text-white">{missingBarcode}</span> is not registered.
              </p>
              <Link
                href={`/products/new?barcode=${encodeURIComponent(missingBarcode)}&return=/stock-in`}
                className="w-full flex items-center justify-center gap-2 py-2.5 gold-gradient text-dark-950 font-semibold rounded-lg text-sm"
              >
                <Plus className="w-4 h-4" /> Create Product & Return to Receive
              </Link>
            </section>
          )}

          <Field label="Product" required>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelected(null);
                    setMissingBarcode("");
                  }}
                  placeholder="Search name or scan barcode"
                  className={`${inputClass} pl-12`}
                />
              </div>
              <button
                type="button"
                onClick={startScanner}
                className="px-4 py-3 rounded-xl gold-gradient text-dark-950 font-semibold whitespace-nowrap"
              >
                📷 Scan
              </button>
            </div>

            {matches.length > 0 && (
              <div className="mt-2 bg-dark-900 border border-dark-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choose(p)}
                    className="w-full px-4 py-3 text-left hover:bg-dark-800 transition-colors border-b border-dark-800 last:border-0"
                  >
                    <p className="text-sm text-white">{p.name}</p>
                    <p className="text-xs text-dark-400">
                      Stock {p.stock} · {p.barcode ?? "no barcode"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Field>

          {selected && (
            <div className="p-3 bg-dark-900 border border-gold-400/20 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-gold-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{selected.name}</p>
                <p className="text-xs text-dark-400">Current stock: {selected.stock}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity received" required>
              <input
                ref={quantityInputRef}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                placeholder="0"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Unit cost (R)">
              <input
                type="number"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                step="0.01"
                min="0"
                placeholder="0.00"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Supplier">
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={selectClass}
            >
              <option value="">No supplier specified</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Invoice number, batch, etc."
              className={textareaClass}
            />
          </Field>

          {quantity && purchaseCost && (
            <div className="flex justify-between text-sm p-3 bg-dark-900 rounded-xl">
              <span className="text-dark-400">Total delivery cost</span>
              <span className="text-gold-400 font-semibold">
                {money(Number(quantity) * Number(purchaseCost))}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !selected || !quantity}
            className="w-full flex items-center justify-center gap-2 py-3.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowDownCircle className="w-5 h-5" />
            {saving ? "Saving..." : "Receive Stock"}
          </button>
        </form>

        <div className="glass-card rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Deliveries</h2>
          {history.length === 0 ? (
            <EmptyState
              icon={<ArrowDownCircle className="w-6 h-6 text-dark-500" />}
              title="No deliveries recorded"
              message="Received stock will be listed here."
            />
          ) : (
            <div className="divide-y divide-dark-800 max-h-[520px] overflow-y-auto">
              {history.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center flex-shrink-0">
                    <ArrowDownCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {r.productName ?? "Unknown product"}
                    </p>
                    <p className="text-xs text-dark-400">{formatDateTime(r.createdAt)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-green-400">+{r.quantity}</p>
                    {r.purchaseCost && (
                      <p className="text-xs text-dark-500">{money(r.purchaseCost)} ea</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={showScannerModal}
        onClose={() => {
          stopWebScanner();
          setShowScannerModal(false);
        }}
        title="Scan Warehouse Barcode"
      >
        <div className="space-y-4">
          {scannerError ? (
            <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl">{scannerError}</p>
          ) : (
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-dark-700">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-1/2 border-2 border-gold-400/80 rounded-xl" />
              </div>
            </div>
          )}
          <button
            onClick={() => {
              stopWebScanner();
              setShowScannerModal(false);
            }}
            className="w-full py-2.5 bg-dark-800 text-dark-300 font-medium rounded-xl hover:text-white"
          >
            Close Scanner
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function StockInPage() {
  return (
    <Suspense fallback={<Spinner label="Loading Stock In..." />}>
      <StockInContent />
    </Suspense>
  );
}
