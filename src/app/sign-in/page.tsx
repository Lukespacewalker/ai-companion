import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OwnerAuthCard } from "@/components/owner-auth-card";
import { getOwnerSession, getOwnerState } from "@/lib/owner";

export const metadata: Metadata = { title: "Sign in" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await getOwnerSession(await headers());
  if (session) redirect("/");

  const state = await getOwnerState();

  return (
    <main className="auth-page">
      <div className="auth-backdrop" aria-hidden="true" />
      <OwnerAuthCard state={state} />
    </main>
  );
}
