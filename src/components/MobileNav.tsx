"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { mobileNavItems, isActivePath } from "./nav-items";

export default function MobileNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-dark-900/95 backdrop-blur-lg border-t border-dark-800 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {mobileNavItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                active ? "text-gold-400" : "text-dark-400 active:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.short}</span>
              {active && <span className="absolute bottom-0 h-0.5 w-8 rounded-full gold-gradient" />}
            </Link>
          );
        })}

        <button
          onClick={onMore}
          className="flex flex-col items-center justify-center gap-1 py-2.5 text-dark-400 active:text-white transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
