"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, X } from "lucide-react";
import { navItems, isActivePath } from "./nav-items";
import type { SessionUser } from "@/lib/auth";

interface SidebarProps {
  user: SessionUser;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ user, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-dark-900 border-r border-dark-800 z-50 transition-transform duration-300 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-5 flex items-center justify-between border-b border-dark-800">
            <Link href="/" onClick={onClose} className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-dark-950" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm gold-text truncate">God&apos;s Empire</h1>
                <p className="text-xs text-dark-400">POS System</p>
              </div>
            </Link>
            <button
              onClick={onClose}
              className="md:hidden text-dark-400 hover:text-white p-1"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {navItems.filter((item) => item.roles.includes(user.role)).map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-gold-400/10 text-gold-400 border border-gold-400/20"
                      : "text-dark-300 hover:bg-dark-800 hover:text-white border border-transparent"
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-dark-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-dark-700 flex items-center justify-center text-sm font-semibold text-gold-400 flex-shrink-0">
                {user.fullName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
                <p className="text-xs text-dark-400 capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
