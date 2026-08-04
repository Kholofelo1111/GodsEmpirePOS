import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-dark-800 flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
      )}
      <p className="text-white font-medium">{title}</p>
      {message && <p className="text-dark-400 text-sm mt-1">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
