"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";
import QRCodeLib from "qrcode";
import { Receipt, Printer, Eye, Banknote, CreditCard, Share2, FileDown } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Barcode from "@/components/Barcode";
import QRCode from "@/components/QRCode";
import { money, formatDateTime } from "@/lib/format";
import type { BusinessInfo } from "@/lib/queries";

interface Sale {
  id: number;
  receiptNumber: string;
  total: string;
  paymentMethod: "cash" | "card" | "split" | "eft" | "voucher";
  createdAt: string;
}

interface SaleDetail extends Sale {
  subtotal: string;
  discount: string;
  vatAmount: string;
  amountTendered: string | null;
  changeGiven: string | null;
  amountPaid?: string | null;
  outstandingBalance?: string | null;
  cashier: string | null;
  customerName: string | null;
  items: { id: number; name: string | null; quantity: number; unitPrice: string; totalPrice: string }[];
}

export default function ReceiptsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  
  async function downloadPDF() {
    if (!detail) return;

    const lineHeight = 5;

    const pageHeight =
      95 +
      detail.items.length * lineHeight +
      55;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, pageHeight],
    });

    let y = 8;

    pdf.setFont("helvetica","bold");
    pdf.setFontSize(15);
    pdf.text(business?.name ?? "God's Empire",40,y,{align:"center"});

    y += 6;

    pdf.setFont("helvetica","normal");
    pdf.setFontSize(8);

    if (business?.address){
      pdf.text(business.address,40,y,{align:"center"});
      y += 4;
    }

    if (business?.phone){
      pdf.text(business.phone,40,y,{align:"center"});
      y += 4;
    }

    pdf.setLineDashPattern([1,1],0);
    pdf.line(5,y,75,y);
    pdf.setLineDashPattern([],0);

    y += 6;

    pdf.text(`Receipt : ${detail.receiptNumber}`,5,y);
    y += 4;
    pdf.text(`Date : ${formatDateTime(detail.createdAt)}`,5,y);
    y += 4;
    pdf.text(`Cashier : ${detail.cashier ?? "Store Operator"}`,5,y);
    y += 4;
    pdf.text(`Payment : ${detail.paymentMethod.toUpperCase()}`,5,y);

    if(detail.customerName){
      y += 4;
      pdf.text(`Customer : ${detail.customerName}`,5,y);
    }

    y += 5;

    pdf.setLineDashPattern([1,1],0);
    pdf.line(5,y,75,y);
    pdf.setLineDashPattern([],0);

    y += 5;

    pdf.setFont("helvetica","bold");
    pdf.text("Item",5,y);
    pdf.text("Total",75,y,{align:"right"});
    pdf.setFont("helvetica","normal");

    y += 5;

    detail.items.forEach(item=>{
      pdf.text(`${item.quantity} x ${item.name ?? "Item"}`,5,y);
      pdf.text(money(item.totalPrice),75,y,{align:"right"});
      y += lineHeight;
    });

    pdf.setLineDashPattern([1,1],0);
    pdf.line(5,y,75,y);
    pdf.setLineDashPattern([],0);

    y += 6;

    pdf.text("Subtotal",5,y);
    pdf.text(money(detail.subtotal),75,y,{align:"right"});

    y += 5;

    pdf.text("VAT",5,y);
    pdf.text(money(detail.vatAmount),75,y,{align:"right"});

    if(Number(detail.discount)>0){
      y += 5;
      pdf.text("Discount",5,y);
      pdf.text("-"+money(detail.discount),75,y,{align:"right"});
    }

    y += 6;

    pdf.setFont("helvetica","bold");
    pdf.setFontSize(13);

    pdf.text("TOTAL",5,y);
    pdf.text(money(detail.total),75,y,{align:"right"});

    pdf.setFont("helvetica","normal");
    pdf.setFontSize(8);

    y += 7;

    pdf.text("Paid",5,y);
    pdf.text(money(detail.amountPaid ?? detail.amountTendered ?? detail.total),75,y,{align:"right"});

    y += 5;

    pdf.text("Change",5,y);
    pdf.text(money(detail.changeGiven ?? 0),75,y,{align:"right"});

    y += 8;

    pdf.text("Thank you for shopping!",40,y,{align:"center"});
    y += 4;
    pdf.text("Please come again",40,y,{align:"center"});


    const barcodeCanvas = document.createElement("canvas");

    JsBarcode(barcodeCanvas, detail.receiptNumber, {
      format: "CODE128",
      displayValue: false,
      width: 1.5,
      height: 24,
      margin: 0,
    });

    pdf.addImage(
      barcodeCanvas.toDataURL("image/png"),
      "PNG",
      15,
      y + 2,
      50,
      12
    );

    y += 18;

    const qrData = await QRCodeLib.toDataURL(
      `Receipt:${detail.receiptNumber}|Total:${detail.total}`
    );

    pdf.addImage(
      qrData,
      "PNG",
      27,
      y,
      26,
      26
    );

    y += 30;

    pdf.save(`${detail.receiptNumber}.pdf`);

  }

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        fetch("/api/sales").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ]);
      setSales(Array.isArray(s) ? s : []);
      setBusiness(b);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sales;
    return sales.filter((s) => s.receiptNumber.toLowerCase().includes(term));
  }, [sales, search]);

  const totalToday = useMemo(() => {
    const today = new Date().toDateString();
    return sales
      .filter((s) => new Date(s.createdAt).toDateString() === today)
      .reduce((sum, s) => sum + Number(s.total), 0);
  }, [sales]);

  const open = async (id: number) => {
    setLoadingDetail(true);
    try {
      const data = await fetch(`/api/sales/${id}`).then((r) => r.json());
      setDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleShare = async () => {
    if (!detail) return;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 200],
    });

    pdf.text(business?.name ?? "God's Empire", 40, 10, { align: "center" });
    pdf.text(`Receipt: ${detail.receiptNumber}`, 5, 20);
    pdf.text(`Total: ${money(detail.total)}`, 5, 26);

    const blob = pdf.output("blob");
    const file = new File(
      [blob],
      `${detail.receiptNumber}.pdf`,
      { type: "application/pdf" }
    );

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        title: detail.receiptNumber,
      });
      return;
    }

    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="animate-fadeIn space-y-5">
      <PageHeader
        title="Receipts"
        subtitle={`${sales.length} transaction${sales.length === 1 ? "" : "s"} · ${money(
          totalToday
        )} today`}
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search receipt number..." />

      {loading ? (
        <Spinner label="Loading receipts..." />
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl">
          <EmptyState
            icon={<Receipt className="w-6 h-6 text-dark-500" />}
            title="No receipts found"
            message="Completed sales appear here."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filtered.map((sale) => (
            <button
              key={sale.id}
              onClick={() => open(sale.id)}
              className="glass-card rounded-2xl p-5 text-left hover:border-gold-400/30 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-5 h-5 text-gold-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{sale.receiptNumber}</p>
                  <p className="text-xs text-dark-400">{formatDateTime(sale.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-dark-800">
                <Badge tone={sale.paymentMethod === "cash" ? "success" : "info"}>
                  <span className="flex items-center gap-1">
                    {sale.paymentMethod === "cash" ? (
                      <Banknote className="w-3 h-3" />
                    ) : (
                      <CreditCard className="w-3 h-3" />
                    )}
                    {sale.paymentMethod}
                  </span>
                </Badge>
                <span className="text-base font-bold text-gold-400">{money(sale.total)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={!!detail || loadingDetail}
        onClose={() => setDetail(null)}
        title={detail?.receiptNumber ?? "Receipt"}
      >
        {loadingDetail || !detail ? (
          <Spinner />
        ) : (
          <>
            <div ref={receiptRef} id="receipt" className="bg-white text-black rounded-xl p-5 font-mono text-[12px] max-h-[75vh] overflow-y-auto">
              <div className="text-center mb-3">
                <p className="font-bold text-base">{business?.name ?? "God's Empire"}</p>
                <p className="text-[10px] leading-tight">{business?.address}</p>
                <p className="text-[10px]">{business?.phone}</p>
              </div>

              <div className="border-t border-dashed border-black/40 py-2 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Receipt</span>
                  <span>{detail.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date</span>
                  <span>{formatDateTime(detail.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier</span>
                  <span>{detail.cashier ?? "Store Operator"}</span>
                </div>
                {detail.customerName && (
                  <div className="flex justify-between">
                    <span>Customer</span>
                    <span>{detail.customerName}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-black/40 py-2 space-y-1">
                {detail.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {item.quantity} × {item.name ?? "Item"}
                    </span>
                    <span>{money(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black/40 py-2 space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(detail.subtotal)}</span>
                </div>
                {Number(detail.discount) > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>-{money(detail.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>VAT</span>
                  <span>{money(detail.vatAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-black/30 mt-1 pt-1">
                  <span>TOTAL</span>
                  <span>{money(detail.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid ({detail.paymentMethod})</span>
                  <span>{money(detail.amountPaid ?? detail.amountTendered ?? detail.total)}</span>
                </div>
                {Number(detail.outstandingBalance) > 0 && (
                  <div className="flex justify-between font-bold text-red-600 print:text-black">
                    <span>Outstanding Balance</span>
                    <span>{money(detail.outstandingBalance)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Change</span>
                  <span>{money(detail.changeGiven ?? 0)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-black/40 py-3 flex flex-col items-center gap-2">
                <div className="flex items-center justify-center gap-6 w-full">
                  <div className="flex flex-col items-center">
                    <Barcode value={detail.receiptNumber} height={32} width={1.2} fontSize={9} />
                  </div>
                  <div className="flex flex-col items-center">
                    <QRCode value={`GE:${detail.receiptNumber}:${detail.total}`} size={64} />
                  </div>
                </div>
                <p className="text-[9px] font-mono text-center text-dark-500 print:text-black">
                  Scan QR code or Barcode to verify receipt
                </p>
              </div>

              <p className="text-center text-[10px] border-t border-dashed border-black/40 pt-2">
                {business?.receiptFooter}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mt-5 print:hidden">
              <button
                onClick={async () => {
                  if (!detail) return;

                  const pdf = new jsPDF({
                    orientation: "portrait",
                    unit: "mm",
                    format: [80, 200],
                  });

                  pdf.text(business?.name ?? "God's Empire", 40, 10, { align: "center" });
                  pdf.text(`Receipt: ${detail.receiptNumber}`, 5, 20);
                  pdf.text(`Total: ${money(detail.total)}`, 5, 26);

                  const blob = pdf.output("blob");
                  const url = URL.createObjectURL(blob);

                  const win = window.open(url, "_blank");

                  if (win) {
                    win.onload = () => {
                      win.print();
                    };
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-dark-800 text-dark-200 rounded-xl hover:bg-dark-700 transition-colors text-sm font-medium"
                title="Print receipt on Android or Desktop printer"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
              <button
                onClick={downloadPDF}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-dark-800 text-dark-200 rounded-xl hover:bg-dark-700 transition-colors text-sm font-medium"
                title="Save receipt as PDF using browser or Android Print dialog"
              >
                <FileDown className="w-4 h-4" /> Save PDF
              </button>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-dark-800 text-dark-200 rounded-xl hover:bg-dark-700 transition-colors text-sm font-medium"
                title="Share receipt via Android share or clipboard"
              >
                <Share2 className="w-4 h-4" /> Share PDF
              </button>
              <button
                onClick={() => setDetail(null)}
                className="px-6 py-2.5 gold-gradient text-dark-950 font-semibold rounded-xl text-sm"
              >
                Close
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
