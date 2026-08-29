import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import AuthShell from "@/components/AuthShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "God's Empire POS",
  description: "Point of Sale & Inventory Management System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1119",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-dark-950 text-white antialiased">
        <AuthShell>{children}</AuthShell>
      </body>
    </html>
  );
}
