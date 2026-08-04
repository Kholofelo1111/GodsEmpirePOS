import type { ReactNode } from "react";

export function Field({
  label,
  required,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-dark-300 mb-2">
        {label} {required && <span className="text-gold-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-dark-500 mt-1.5">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "w-full px-4 py-3 bg-dark-900 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all";

export const selectClass = inputClass;

export const textareaClass = `${inputClass} resize-none`;
