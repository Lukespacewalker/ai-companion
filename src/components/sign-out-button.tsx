"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const result = await authClient.signOut();
    if (result.error) {
      setPending(false);
      window.alert(result.error.message || "Sign out failed.");
      return;
    }
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <button
      className="button ghost small"
      type="button"
      disabled={pending}
      onClick={signOut}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
