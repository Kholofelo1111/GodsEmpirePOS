"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileNav from "./MobileNav";
import { DEFAULT_USER } from "@/lib/auth";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dark-950">
      <Sidebar
        user={DEFAULT_USER}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col min-h-screen md:ml-64">
        <Header
          user={DEFAULT_USER}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-x-hidden print:p-0">
          {children}
        </main>
      </div>

      <MobileNav onMore={() => setSidebarOpen(true)} />
    </div>
  );
}
