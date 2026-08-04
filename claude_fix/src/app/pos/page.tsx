"use client";

import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { Capacitor } from "@capacitor/core";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  ShoppingBag,
  CheckCircle,
  UserPlus,
  Printer,
  Camera,
  Landmark,
  Ticket,
  SplitSquareHorizontal,
} from "lucide-react";
import SearchInput from "@/components/ui/SearchInput";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { Field, inputClass, selectClass } from "@/components/ui/Field";
import { money } from "@/lib/format";
import type { BusinessInfo } from "@/lib/queries";
import { scanFeedback, createScanDebouncer, createRetailScanTracker, useHardwareScanner } from "@/lib/scanFeedback";
import Barcode from "@/components/Barcode";
import QRCode from "@/components/QRCode";
import Link from "next/link";

// BarcodeDetector is not in the TS DOM lib yet.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

interface Product {
  id: number;
  name: string;
  barcode: string | null;
  sellingPrice: string;
  stock: number;
  categoryId: number | null;
  categoryName: string | null;
  imageUrl: string | null;
}

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

interface PaymentLeg {
  method: "cash" | "card" | "eft" | "voucher";
  amount: number;
}

interface CompletedSale {
  receiptNumber: string;
  items: CartItem[];
  subtotal: number;
  vat: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  outstanding?: number;
  method: string;
  payments: PaymentLeg[];
  cashierName: string;
  at: string;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([]);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | "all">("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("");
  const [includeVAT, setIncludeVAT] = useState(true);
  const [customerId, setCustomerId] = useState("");
  const [unknownBarcode, setUnknownBarcode] = useState("");
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "eft" | "voucher" | "split">("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [splitCash, setSplitCash] = useState("");
  const [splitCard, setSplitCard] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<CompletedSale | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const shouldProcessScan = useRef(createRetailScanTracker(700).canScan).current;

  const loadData = useCallback(async () => {
    try {
      const [p, c, cu, s] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/categories").then((r) => r.json()),
        fetch("/api/customers").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setCategories(Array.isArray(c) ? c : []);
      setCustomers(Array.isArray(cu) ? cu : []);
      setBusiness(s);
    } catch {
      setError("Could not load products. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const vatRate = business?.vatRate ?? 15;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCat = activeCategory === "all" || p.categoryId === activeCategory;
      const matchesTerm =
        !term || p.name.toLowerCase().includes(term) || (p.barcode ?? "").includes(term);
      return matchesCat && matchesTerm;
    });
  }, [products, search, activeCategory]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: Number(product.sellingPrice),
          quantity: 1,
          stock: product.stock,
        },
      ];
    });
  };

  useEffect(() => {
    const barcode = new URLSearchParams(window.location.search).get("barcode");
    if (!barcode || products.length === 0) return;

    const product = products.find((p) => p.barcode === barcode);
    if (!product) return;

    addToCart(product);
    window.history.replaceState({}, "", "/pos");
  }, [products]);



  // Scanning a full barcode into the search box adds the item straight to the cart.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 8) return;
    const exact = products.find((p) => p.barcode === term);
    if (exact) {
      addToCart(exact);
      setSearch("");
    }
  }, [search, products]);

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.id !== id) return [item];
        const next = item.quantity + delta;
        if (next <= 0) return [];
        if (next > item.stock) return [item];
        return [{ ...item, quantity: next }];
      })
    );
  };

  const removeItem = (id: number) => setCart((prev) => prev.filter((i) => i.id !== id));

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountValue = Math.min(Number(discount || 0), subtotal);
  const taxable = subtotal - discountValue;
  const vatAmount = includeVAT ? taxable * (vatRate / 100) : 0;
  const total = taxable + vatAmount;
  const tendered = Number(amountTendered || 0);
  const change = Math.max(0, tendered - total);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const splitCashValue = Number(splitCash || 0);
  const splitCardValue = Number(splitCard || 0);
  const splitTotal = splitCashValue + splitCardValue;
  const splitRemaining = Math.round((total - splitTotal) * 100) / 100;

  /** Builds the payment legs to submit, based on the selected payment mode. */
  const buildPayments = (): PaymentLeg[] => {
    if (paymentMethod === "split") {
      const legs: PaymentLeg[] = [];
      if (splitCashValue > 0) legs.push({ method: "cash", amount: splitCashValue });
      if (splitCardValue > 0) legs.push({ method: "card", amount: splitCardValue });
      return legs;
    }
    const amt = tendered > 0 && tendered < total && customerId ? tendered : total;
    return [{ method: paymentMethod, amount: amt }];
  };



  const exportReceiptPDF = async () => {
    if (!completed) return;

    const receiptEl = document.getElementById("receipt");
    if (!receiptEl) {
      alert("Could not generate receipt PDF.");
      return;
    }

    try {
      // Snapshot the exact on-screen receipt node — this is the single source
      // of truth, so there is no separate layout to keep in sync.
      const scale = 3; // render at higher density so text/barcode stay crisp
      const canvas = await html2canvas(receiptEl, {
        scale,
        backgroundColor: "#ffffff",
        useCORS: true, // allow the remote business logo to be captured
      });

      const imgData = canvas.toDataURL("image/png");

      // Size the PDF page to match the receipt's own aspect ratio (a narrow
      // thermal-style slip) instead of forcing it onto an A4 page.
      const pxToMm = 25.4 / 96; // 1 CSS px = 1/96 inch
      const pdfWidth = (canvas.width / scale) * pxToMm;
      const pdfHeight = (canvas.height / scale) * pxToMm;

      const pdf = new jsPDF({
        orientation: pdfHeight >= pdfWidth ? "portrait" : "landscape",
        unit: "mm",
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${completed.receiptNumber}.pdf`);
    } catch (err) {
      console.error("Receipt PDF export failed:", err);
      alert("Could not generate receipt PDF.");
    }
  };


  const checkout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    setError("");

    try {
      const payments = buildPayments();
      const paidAmt = paymentMethod === "cash" ? Math.min(total, tendered || total) : total;
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.id,
            quantity: i.quantity,
            unitPrice: i.price,
            totalPrice: i.price * i.quantity,
          })),
          discount: discountValue,
          vatAmount,
          total,
          paymentMethod,
          payments,
          amountTendered: paymentMethod === "cash" ? tendered : undefined,
          changeGiven: paymentMethod === "cash" ? change : 0,
          customerId: customerId ? Number(customerId) : null,
          allowDebt: Boolean(customerId),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail = Array.isArray(data.details) && data.details.length > 0 ? `: ${data.details.join("; ")}` : "";
        throw new Error((data.error || "Sale failed") + detail);
      }

      const sale = await res.json();
      setCompleted({
        receiptNumber: sale.receiptNumber,
        items: cart,
        subtotal,
        vat: vatAmount,
        discount: discountValue,
        total,
        paid: paymentMethod === "cash" ? tendered : total,
        change: paymentMethod === "cash" ? change : 0,
        outstanding: Math.max(0, total - paidAmt),
        method: paymentMethod,
        payments: sale.payments ?? payments,
        cashierName: sale.cashierName ?? "Store Operator",
        at: new Date().toLocaleString("en-ZA"),
      });

      setCart([]);
      setDiscount("");
      setAmountTendered("");
      setSplitCash("");
      setSplitCard("");
      setCustomerId("");
      setShowPayment(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sale failed");
    } finally {
      setProcessing(false);
    }
  };

  /** Handles one decoded barcode: debounce, look up, add to cart, give feedback. Feature 11. */
  const handleScannedCode = useCallback(
    (code: string) => {
      const codeTrim = code.trim();
      if (!codeTrim || !shouldProcessScan(codeTrim)) return;

      const product = products.find((p) => p.barcode === codeTrim);
      if (product) {
        addToCart(product);
        setHighlightedId(product.id);
        setTimeout(() => setHighlightedId(null), 1500);
        scanFeedback();
        setScannerError("");
        setUnknownBarcode("");
      } else {
        setUnknownBarcode(codeTrim);
        setScannerError("");
      }
    },
    [products, addToCart, shouldProcessScan]
  );

  useHardwareScanner(handleScannedCode, true);

  const startWebScanner = useCallback(async () => {
    setScannerError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setShowScanner(true);
      setScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Detector) {
        setScannerError("Live scanning isn't supported by this browser. Use the search box to find products instead.");
        return;
      }
      const detector = new Detector({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
      });

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            handleScannedCode(codes[0].rawValue);
          }
        } catch {
          /* frame not ready — keep scanning */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setScannerError("Camera access denied. Allow camera permission to scan, or search for products instead.");
      setScanning(false);
    }
  }, [handleScannedCode]);

  const startScanner = async () => {
    setScannerError("");
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

      setScanning(true);
      // Scan continuously: ML Kit's scan() returns after each detection, so
      // we immediately re-open it — letting the cashier scan Product A, B,
      // C... in sequence without re-tapping "Scan" each time (Feature 7).
      // The loop ends when scan() rejects (user cancelled) or returns empty.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { barcodes } = await BarcodeScanner.scan();
        if (!barcodes.length) break;
        const code = barcodes[0].rawValue ?? "";
        if (!code) break;
        handleScannedCode(code);
      }
    } catch (e) {
      console.error(e);
      // A cancelled scan also lands here — that's expected, not an error to surface.
    } finally {
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
    setShowScanner(false);
    setScannerError("");
  };

  if (loading) return <Spinner label="Loading till..." />;

  return (
    <div className="animate-fadeIn flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-8rem)]">
      {/* Catalogue */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="space-y-3 mb-4">
          <button
            onClick={startScanner}
            className="flex items-center justify-center gap-2 w-full py-3 mb-3 gold-gradient text-dark-950 font-semibold rounded-xl"
          >
            <Camera className="w-5 h-5" />
            {scanning && Capacitor.isNativePlatform() ? "Scanning... (tap back to stop)" : "Scan Barcode"}
          </button>

          {!showScanner && scannerError && (
            <div className="flex items-center justify-between gap-3 p-3 bg-orange-400/10 border border-orange-400/20 rounded-xl text-orange-300 text-sm">
              <span>{scannerError}</span>
              <button onClick={() => setScannerError("")} className="text-orange-300/70 hover:text-orange-200">
                ✕
              </button>
            </div>
          )}

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search or scan barcode..."
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === "all"
                  ? "gold-gradient text-dark-950"
                  : "bg-dark-800 text-dark-300 hover:text-white"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? "gold-gradient text-dark-950"
                    : "bg-dark-800 text-dark-300 hover:text-white"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 lg:overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="w-6 h-6 text-dark-500" />}
              title="No products found"
              message="Try a different search term or category."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className="glass-card rounded-xl p-3 text-left hover:border-gold-400/40 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  <div className="w-full aspect-[4/3] bg-dark-800 rounded-lg mb-2.5 flex items-center justify-center overflow-hidden">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-7 h-7 text-dark-600 group-hover:text-gold-400 transition-colors" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-white line-clamp-2 leading-snug">{product.name}</p>

{product.categoryName && (
  <span className="inline-block mt-1 px-2 py-1 rounded-full bg-dark-800 text-gold-400 text-[10px] font-medium">
    {product.categoryName}
  </span>
)}

<p className="text-gold-400 font-bold mt-2">{money(product.sellingPrice)}</p>
                  <p
                    className={`text-xs mt-0.5 ${
                      product.stock <= 0 ? "text-red-400" : "text-dark-400"
                    }`}
                  >
                    {product.stock <= 0 ? "Out of stock" : `${product.stock} in stock`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="w-full lg:w-96 glass-card rounded-2xl flex flex-col lg:max-h-full">
        <div className="p-4 border-b border-dark-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Current Sale</h2>
            <p className="text-xs text-dark-400">
              {cartCount} item{cartCount === 1 ? "" : "s"}
            </p>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-dark-400 hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[160px] max-h-[38vh] lg:max-h-none">
          {cart.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="w-6 h-6 text-dark-500" />}
              title="Cart is empty"
              message="Tap a product to add it."
            />
          ) : (
            cart.map((item) => (
              <div key={item.id} className="bg-dark-900/60 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-white leading-snug">{item.name}</p>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-dark-500 hover:text-red-400 transition-colors flex-shrink-0"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-dark-200 hover:bg-dark-600 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-semibold text-white w-7 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      disabled={item.quantity >= item.stock}
                      className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-dark-200 hover:bg-dark-600 transition-colors disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-gold-400">
                    {money(item.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-dark-800 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-dark-400 flex-shrink-0" />
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="flex-1 px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-gold-400"
            >
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-dark-400">Subtotal</span>
            <span className="text-white">{money(subtotal)}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-dark-400">Discount</span>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-24 px-2 py-1 bg-dark-900 border border-dark-700 rounded-lg text-white text-right text-sm focus:outline-none focus:border-gold-400"
            />
          </div>

          <label className="flex justify-between items-center text-sm cursor-pointer">
            <span className="text-dark-400 flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeVAT}
                onChange={(e) => setIncludeVAT(e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 accent-gold-400"
              />
              VAT ({vatRate}%)
            </span>
            <span className="text-white">{money(vatAmount)}</span>
          </label>

          <div className="flex justify-between items-center pt-3 border-t border-dark-700">
            <span className="text-base font-semibold text-white">Total</span>
            <span className="text-xl font-bold text-gold-400">{money(total)}</span>
          </div>

          <button
            onClick={() => {
              setAmountTendered("");
              setShowPayment(true);
            }}
            disabled={cart.length === 0}
            className="w-full py-3.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Charge {money(total)}
          </button>
        </div>
      </div>

      {/* Payment modal */}
      <Modal open={showPayment} onClose={() => setShowPayment(false)} title="Take Payment">
        <div className="text-center mb-5">
          <p className="text-sm text-dark-400">Amount due</p>
          <p className="text-4xl font-bold text-gold-400 mt-1">{money(total)}</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-5">
          {(
            [
              { key: "cash", label: "Cash", icon: Banknote },
              { key: "card", label: "Card", icon: CreditCard },
              { key: "eft", label: "EFT", icon: Landmark },
              { key: "voucher", label: "Voucher", icon: Ticket },
              { key: "split", label: "Split", icon: SplitSquareHorizontal },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setPaymentMethod(key)}
              className={`p-4 rounded-xl border-2 transition-all ${
                paymentMethod === key
                  ? "border-gold-400 bg-gold-400/10"
                  : "border-dark-700 hover:border-dark-600"
              }`}
            >
              <Icon
                className={`w-7 h-7 mx-auto mb-2 ${
                  paymentMethod === key ? "text-gold-400" : "text-dark-400"
                }`}
              />
              <p className="text-sm font-medium text-white">{label}</p>
            </button>
          ))}
        </div>

        {paymentMethod === "cash" && (
          <div className="mb-5 space-y-3">
            <Field label="Amount tendered">
              <input
                type="number"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                className={inputClass}
                placeholder="0.00"
                step="0.01"
                min={0}
                autoFocus
              />
            </Field>

            <div className="flex gap-2 flex-wrap">
              {[total, 50, 100, 200, 500].map((amt, idx) => (
                <button
                  key={idx}
                  onClick={() => setAmountTendered(String(Math.max(amt, idx === 0 ? amt : 0)))}
                  className="px-3 py-1.5 rounded-lg bg-dark-800 text-dark-200 text-xs font-medium hover:bg-dark-700 transition-colors"
                >
                  {idx === 0 ? "Exact" : money(amt)}
                </button>
              ))}
            </div>

            {tendered > 0 && tendered < total && (
              <div
                className={`p-3 rounded-xl text-sm font-medium ${
                  customerId
                    ? "bg-orange-500/10 border border-orange-500/30 text-orange-400"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                }`}
              >
                {customerId
                  ? `Partial Payment: R ${money(total - tendered)} will be recorded as Outstanding Balance for this customer.`
                  : `Insufficient payment. Select a Registered Customer above to record customer debt.`}
              </div>
            )}

{tendered >= total && tendered > 0 && (
              <div className="p-3 bg-green-400/10 border border-green-400/20 rounded-xl flex items-center justify-between">
                <span className="text-sm text-dark-200">Change due</span>
                <span className="text-2xl font-bold text-green-400">{money(change)}</span>
              </div>
            )}
          </div>
        )}

        {paymentMethod === "split" && (
          <div className="mb-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cash amount">
                <input
                  type="number"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                  step="0.01"
                  min={0}
                  autoFocus
                />
              </Field>
              <Field label="Card amount">
                <input
                  type="number"
                  value={splitCard}
                  onChange={(e) => setSplitCard(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                  step="0.01"
                  min={0}
                />
              </Field>
            </div>

            {splitRemaining > 0.005 && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium">
                Still needs {money(splitRemaining)} to reach the total.
              </div>
            )}
            {splitRemaining < -0.005 && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium">
                Payments exceed the total by {money(Math.abs(splitRemaining))}.
              </div>
            )}
            {Math.abs(splitRemaining) <= 0.005 && splitTotal > 0 && (
              <div className="p-3 bg-green-400/10 border border-green-400/20 rounded-xl flex items-center justify-between">
                <span className="text-sm text-dark-200">Cash {money(splitCashValue)} + Card {money(splitCardValue)}</span>
                <span className="text-lg font-bold text-green-400">= {money(splitTotal)}</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={checkout}
          disabled={
            processing ||
            (paymentMethod === "cash" && tendered < total && !customerId) ||
            (paymentMethod === "split" && splitRemaining > 0.005 && !customerId) ||
            (paymentMethod === "split" && splitRemaining < -0.005)
          }
          className="w-full py-3.5 gold-gradient text-dark-950 font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {processing ? "Processing..." : "Complete Sale"}
        </button>
      </Modal>

      {/* Receipt */}
      <Modal open={!!completed} onClose={() => setCompleted(null)} title="Sale Complete">
        {completed && (
          <>
            <div className="flex flex-col items-center mb-5">
              <div className="w-14 h-14 rounded-full bg-green-400/10 flex items-center justify-center mb-3">
                <CheckCircle className="w-7 h-7 text-green-400" />
              </div>
              <p className="text-sm text-dark-400">Change due</p>
              <p className="text-3xl font-bold text-green-400">{money(completed.change)}</p>
            </div>

            <div id="receipt" className="bg-white text-black rounded-xl p-5 text-[13px] font-mono">
              <div className="text-center mb-3">
                {business?.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={business.logoUrl} alt="" className="h-12 mx-auto mb-2 object-contain" />
                )}
                <p className="font-bold text-base">{business?.name ?? "God's Empire"}</p>
                <p className="text-[11px] leading-tight">{business?.address}</p>
                <p className="text-[11px]">{business?.phone}</p>
              </div>
              <div className="border-t border-dashed border-black/40 py-2 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Receipt</span>
                  <span>{completed.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date</span>
                  <span>{completed.at}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier</span>
                  <span>{completed.cashierName}</span>
                </div>
              </div>
              <div className="border-t border-dashed border-black/40 py-2 space-y-1">
                {completed.items.map((i) => (
                  <div key={i.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {i.quantity} × {i.name}
                    </span>
                    <span>{money(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-black/40 py-2 space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(completed.subtotal)}</span>
                </div>
                {completed.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>-{money(completed.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>VAT</span>
                  <span>{money(completed.vat)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-black/30 mt-1 pt-1">
                  <span>TOTAL</span>
                  <span>{money(completed.total)}</span>
                </div>
                {completed.payments.map((leg, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="capitalize">{leg.method}</span>
                    <span>{money(leg.amount)}</span>
                  </div>
                ))}
                {completed.change > 0 && (
                  <div className="flex justify-between">
                    <span>Change</span>
                    <span>{money(completed.change)}</span>
                  </div>
                )}
                {completed.outstanding && completed.outstanding > 0 ? (
                  <div className="flex justify-between font-bold text-red-600 print:text-black">
                    <span>Outstanding Balance</span>
                    <span>{money(completed.outstanding)}</span>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-dashed border-black/40 py-3 flex flex-col items-center gap-2">
                <div className="flex items-center justify-center gap-6 w-full">
                  <div className="flex flex-col items-center">
                    <Barcode value={completed.receiptNumber} height={32} width={1.2} fontSize={9} />
                  </div>
                  <div className="flex flex-col items-center">
                    <QRCode value={`GE:${completed.receiptNumber}:${completed.total}`} size={64} />
                  </div>
                </div>
                <p className="text-[9px] font-mono text-center text-dark-500 print:text-black">
                  Scan QR code or Barcode to verify receipt
                </p>
              </div>

              <p className="text-center text-[11px] border-t border-dashed border-black/40 pt-2">
                {business?.receiptFooter}
              </p>
            </div>

            <div className="flex gap-3 mt-5 print:hidden">
              <button
                onClick={exportReceiptPDF}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-dark-800 text-dark-200 rounded-xl hover:bg-dark-700 transition-colors text-sm font-medium"
              >
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
              <button
                onClick={() => setCompleted(null)}
                className="flex-1 py-3 gold-gradient text-dark-950 font-semibold rounded-xl"
              >
                New Sale
              </button>
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={showScanner}
        onClose={stopScanner}
        title="Scan Barcode"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full rounded-xl bg-black"
        />
        <p className="mt-3 text-center text-sm text-dark-300">
          {cartCount} item{cartCount === 1 ? "" : "s"} in cart — keep scanning or close when done
        </p>
        {scannerError && (
          <p className="mt-2 text-sm text-orange-300 text-center">
            {scannerError}
          </p>
        )}
        <button
          onClick={stopScanner}
          className="w-full mt-4 py-3 bg-red-600 text-white rounded-xl"
        >
          Close Scanner
        </button>
      </Modal>
    </div>
  );
}
