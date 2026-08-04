"use client";

import Link from "next/link";
import { Menu, Bell, ShoppingCart, LogOut } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

interface HeaderProps {
  user: SessionUser;
  onMenuClick?: () => void;
}

export default function Header({ user, onMenuClick }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 bg-dark-900/80 backdrop-blur-lg border-b border-dark-800 px-4 md:px-6 py-4">
      <div className="flex items-center justify-between gap-3">

        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-xl bg-dark-800 text-dark-300 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <p className="text-xs text-dark-400">
              God's Empire
            </p>

            <h2 className="text-base md:text-lg font-semibold text-white">
              {user.fullName}
            </h2>

            <p className="text-xs text-gold-400 capitalize">
              {user.role}
            </p>
          </div>
        </div>


        <div className="flex items-center gap-2">

          <Link
            href="/pos"
            className="hidden sm:flex items-center gap-2 px-4 py-2 gold-gradient text-dark-950 text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <ShoppingCart className="w-4 h-4" />
            New Sale
          </Link>


          <Link
            href="/notifications"
            className="relative p-2 rounded-xl bg-dark-800 text-dark-300 hover:text-gold-400 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-gold-400 rounded-full" />
          </Link>


          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>

        </div>

      </div>
    </header>
  );
}
