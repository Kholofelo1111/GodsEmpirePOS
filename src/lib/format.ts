/** Shared formatting helpers — South African Rand (ZAR) and local dates. */

export const CURRENCY = "R";

export function money(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${CURRENCY}${n.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function compactMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 1_000_000) return `${CURRENCY}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${CURRENCY}${(n / 1_000).toFixed(1)}k`;
  return money(n);
}

export function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(value: Date | string): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

export function stockStatus(stock: number, min: number) {
  if (stock <= 0) return { label: "Out of stock", tone: "danger" as const };
  if (stock <= min) return { label: "Low stock", tone: "warning" as const };
  return { label: "In stock", tone: "success" as const };
}
