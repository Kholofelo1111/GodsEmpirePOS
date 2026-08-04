import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "./AppShell";
import type { ReactNode } from "react";

export default async function AuthShell({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell user={user}>
      {children}
    </AppShell>
  );
}
