import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireOwnerPage } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await requireOwnerPage();

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
      }}
    >
      {children}
    </AppShell>
  );
}
