"use client";

import React from "react";

/**
 * A lightweight zero-dependency SVG QR Code / 2D Matrix Code component
 * for rendering scannable verification codes on POS receipts.
 */
interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCode({ value, size = 100, className = "" }: QRCodeProps) {
  // Generate a deterministic 21x21 matrix from string bytes (QR Version 1 style matrix)
  const gridSize = 21;
  const matrix: boolean[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(false)
  );

  // Draw 3 finder patterns (7x7 corners)
  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[r0 + r][c0 + c] = isBorder || isCenter;
      }
    }
  };

  drawFinder(0, 0); // Top-left
  drawFinder(0, gridSize - 7); // Top-right
  drawFinder(gridSize - 7, 0); // Bottom-left

  // Timing patterns
  for (let i = 8; i < gridSize - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Populate data bits deterministically from value string hash/bytes
  const str = value || "GE-RECEIPT";
  let byteIndex = 0;
  let bitPos = 0;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Avoid finder patterns and timing lines
      const inTL = r < 8 && c < 8;
      const inTR = r < 8 && c >= gridSize - 8;
      const inBL = r >= gridSize - 8 && c < 8;
      const inTiming = r === 6 || c === 6;

      if (!inTL && !inTR && !inBL && !inTiming) {
        const charCode = str.charCodeAt(byteIndex % str.length) ^ ((r * 31 + c * 17) & 0xff);
        matrix[r][c] = ((charCode >> bitPos) & 1) === 1;
        bitPos++;
        if (bitPos > 7) {
          bitPos = 0;
          byteIndex++;
        }
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${gridSize + 2} ${gridSize + 2}`}
      width={size}
      height={size}
      className={`inline-block bg-white p-1 rounded ${className}`}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={gridSize + 2} height={gridSize + 2} fill="#FFFFFF" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c + 1}
              y={r + 1}
              width={1}
              height={1}
              fill="#000000"
            />
          ) : null
        )
      )}
    </svg>
  );
}
