import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: "gold" | "green" | "blue" | "orange" | "purple" | "cyan" | "red";
}

const tones: Record<string, string> = {
  gold: "bg-gold-400/10",
  green: "bg-green-400/10",
  blue: "bg-blue-400/10",
  orange: "bg-orange-400/10",
  purple: "bg-purple-400/10",
  cyan: "bg-cyan-400/10",
  red: "bg-red-400/10",
};

export default function StatCard({ label, value, hint, icon, tone = "gold" }: StatCardProps) {
  return (
    <div className="glass-card rounded-2xl p-4 md:p-5 hover:border-gold-400/25 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs md:text-sm text-dark-400 truncate">{label}</p>
          <p className="text-lg md:text-2xl font-bold text-white mt-1 truncate">{value}</p>
          {hint && <p className="text-xs text-dark-500 mt-1 truncate">{hint}</p>}
        </div>
        <div
          className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${tones[tone]} flex items-center justify-center flex-shrink-0`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
