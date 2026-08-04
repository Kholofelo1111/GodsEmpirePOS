"use client";

import React from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { Printer, FileDown, FileSpreadsheet } from "lucide-react";

interface ReportExportActionsProps {
  summary: {
    revenue: number;
    profit: number;
    transactions: number;
    itemsSold: number;
    averageBasket: number;
  };
  periodLabel: string;
  stockValue: number;
  stockRetailValue: number;
  outstandingBalance: number;
  bestSellers: {
    name: string;
    quantity: number;
    revenue: string;
  }[];
}

export default function ReportExportActions({
  summary,
  periodLabel,
  stockValue,
  stockRetailValue,
  outstandingBalance,
  bestSellers,
}: ReportExportActionsProps) {
const exportCSV = () => {
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["God's Empire POS Report"],
    ["Period", periodLabel],
    ["Generated", new Date().toLocaleString("en-ZA")],
    [],
    ["Metric","Value"],
    ["Revenue", summary.revenue],
    ["Profit", summary.profit],
    ["Transactions", summary.transactions],
    ["Items Sold", summary.itemsSold],
    ["Average Basket", summary.averageBasket],
    ["Outstanding Balance", outstandingBalance],
    ["Stock Value (Cost)", stockValue],
    ["Stock Value (Retail)", stockRetailValue],
  ]);

  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  const bestSheet = XLSX.utils.json_to_sheet(bestSellers.map(item => ({
    Product: item.name,
    Quantity: item.quantity,
    Revenue: item.revenue,
  })));

  XLSX.utils.book_append_sheet(wb, bestSheet, "Best Sellers");

  XLSX.writeFile(wb, `GodsEmpire_Report_${periodLabel.replace(/\s+/g,"_")}.xlsx`);
};



  const exportPDF = async (printAfter = false) => {
    const pdf = new jsPDF("p","mm","a4");

    const logo = new Image();
    logo.src="/images/logo.png";

    await new Promise(resolve=>{
      logo.onload=resolve;
      logo.onerror=resolve;
    });

    let y = 18;

// ===== Header =====
pdf.setFillColor(20,20,20);
pdf.rect(0,0,210,28,"F");

pdf.addImage(logo,"PNG",10,4,18,18);

pdf.setTextColor(212,175,55);
pdf.setFont("helvetica","bold");
pdf.setFontSize(20);
pdf.text("GOD'S EMPIRE POS",105,12,{align:"center"});

pdf.setTextColor(255,255,255);
pdf.setFontSize(10);
pdf.text("BUSINESS PERFORMANCE REPORT",105,20,{align:"center"});

pdf.setTextColor(0,0,0);
pdf.setFont("helvetica","normal");
pdf.setFontSize(11);

y = 38;

pdf.text("Period",20,y);
pdf.text(periodLabel,60,y);

pdf.text("Generated",120,y);
pdf.text(new Date().toLocaleString("en-ZA"),150,y);

y += 8;
pdf.setDrawColor(180);
pdf.line(15,y,195,y);

y += 10;

pdf.setFont("helvetica","bold");
pdf.setFontSize(13);
pdf.text("EXECUTIVE SUMMARY",20,y);

y += 6;

pdf.roundedRect(15,y,180,52,3,3);

y += 8;

pdf.setFont("helvetica","normal");
pdf.setFontSize(11);

pdf.text("Revenue",22,y);
pdf.text(`R ${summary.revenue.toFixed(2)}`,120,y);

y += 8;

pdf.text("Profit",22,y);
pdf.text(`R ${summary.profit.toFixed(2)}`,120,y);

y += 8;

pdf.text("Transactions",22,y);
pdf.text(String(summary.transactions),120,y);

y += 8;

pdf.text("Items Sold",22,y);
pdf.text(String(summary.itemsSold),120,y);

y += 8;

pdf.text("Average Basket",22,y);
pdf.text(`R ${summary.averageBasket.toFixed(2)}`,120,y);

y += 12;

pdf.setFont("helvetica","bold");
pdf.text("INVENTORY",20,y);

y += 6;

pdf.roundedRect(15,y,180,28,3,3);

y += 8;

pdf.setFont("helvetica","normal");

pdf.text("Outstanding Balance",22,y);
pdf.text(`R ${outstandingBalance.toFixed(2)}`,120,y);

y += 8;

pdf.text("Stock Value (Cost)",22,y);
pdf.text(`R ${stockValue.toFixed(2)}`,120,y);

y += 8;

pdf.text("Stock Value (Retail)",22,y);
pdf.text(`R ${stockRetailValue.toFixed(2)}`,120,y);

y += 18;

pdf.setFont("helvetica","bold");
pdf.setFontSize(13);
pdf.text("BEST SELLING PRODUCTS",20,y);

y += 8;

pdf.setFillColor(230,230,230);
pdf.rect(15,y-5,180,8,"F");

pdf.setFontSize(10);

pdf.text("#",20,y);
pdf.text("Product",30,y);
pdf.text("Qty",135,y);
pdf.text("Revenue",160,y);

y += 8;

pdf.setFont("helvetica","normal");

bestSellers.forEach((item,index)=>{

  pdf.text(String(index+1),20,y);

  pdf.text(item.name.substring(0,30),30,y);

  pdf.text(String(item.quantity),135,y);

  pdf.text(String(item.revenue),160,y);

  y += 7;

  if(y>280){
    pdf.addPage();
    y=20;
  }

});

    y += 10;
    pdf.setFontSize(9);
    pdf.text(`Generated: ${new Date().toLocaleString("en-ZA")}`,20,y);

    if(printAfter){
      const blob=pdf.output("blob");
      const url=URL.createObjectURL(blob);
      const win=window.open(url,"_blank");
      if(win){
        win.onload=()=>win.print();
      }
    }else{
      pdf.save(`GodsEmpire_Report_${periodLabel.replace(/\s+/g,"_")}.pdf`);
    }
  };


  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button
        onClick={() => exportPDF(true)}
        className="flex items-center gap-2 px-3.5 py-2 bg-dark-800 text-dark-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
        title="Print Report"
      >
        <Printer className="w-4 h-4" /> Print
      </button>

      <button
        onClick={() => exportPDF(false)}
        className="flex items-center gap-2 px-3.5 py-2 bg-dark-800 text-dark-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
        title="Save as PDF via Print dialog"
      >
        <FileDown className="w-4 h-4" /> Export PDF
      </button>

      <button
        onClick={exportCSV}
        className="flex items-center gap-2 px-3.5 py-2 gold-gradient text-dark-950 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
        title="Download Excel / CSV spreadsheet"
      >
        <FileSpreadsheet className="w-4 h-4" /> Export Excel / CSV
      </button>
    </div>
  );
}
