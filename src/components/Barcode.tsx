"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeProps {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  className?: string;
}

/**
 * Renders a scannable Code-128 barcode as an inline SVG.
 * Used both for on-screen preview and for printable labels.
 */
export default function Barcode({ value, height = 60, width = 2, fontSize = 16, className }: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width,
        height,
        displayValue: true,
        fontSize,
        margin: 8,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (err) {
      console.error("Failed to render barcode:", err);
    }
  }, [value, height, width, fontSize]);

  if (!value) return null;

  return <svg ref={svgRef} className={className} />;
}
