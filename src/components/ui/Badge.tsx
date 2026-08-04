import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

const tones: Record<Tone, string> = {
  success: "bg-green-400/10 text-green-400",
  warning: "bg-orange-400/10 text-orange-400",
  danger: "bg-red-400/10 text-red-400",
  info: "bg-blue-400/10 text-blue-400",
  neutral: "bg-dark-700 text-dark-300",
  gold: "bg-gold-400/10 text-gold-400",
};

export default function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
