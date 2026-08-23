"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import type { OwnerState } from "@/lib/owner";

export function OwnerAuthCard({ state }: { state: OwnerState }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const setupMode = state.databaseReady && !state.registered && !state.locked;
  const enabled = state.configured && state.databaseReady && !state.locked;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || !state.ownerEmail) return;

    setPending(true);
    setError("");

    const result = setupMode
      ? await authClient.signUp.email({
          name: name.trim(),
          email: state.ownerEmail,
          password,
        })
      : await authClient.signIn.email({
          email: state.ownerEmail,
          password,
          rememberMe: true,
        });

    if (result.error) {
      setPending(false);
      setError(result.error.message || "Authentication failed.");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  let blockingMessage = "";
  if (!state.configured) {
    blockingMessage = "Set APP_OWNER_EMAIL before starting the application.";
  } else if (!state.databaseReady) {
    blockingMessage = "Run npm run db:migrate before creating the owner account.";
  } else if (state.locked) {
    blockingMessage =
      "The database contains a different account than APP_OWNER_EMAIL. Resolve that mismatch before continuing.";
  }

  return (
    <section className="auth-card">
      <div className="auth-card-header">
        <div>
          <div className="eyebrow">Private owner access</div>
          <h1>{setupMode ? "Create the owner account" : "Welcome back"}</h1>
          <p>
            {setupMode
              ? "This one-time setup creates the only human account accepted by this deployment."
              : "Sign in to reach companions, conversations, memory, and provider settings."}
          </p>
        </div>
        <span className="auth-orbit" aria-hidden="true">
          ◌
        </span>
      </div>

      {blockingMessage ? (
        <div className="notice error" role="alert">
          {blockingMessage}
        </div>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          {setupMode && (
            <label className="field">
              <span>Display name</span>
              <input
                required
                autoComplete="name"
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>
          )}

          <label className="field">
            <span>Owner email</span>
            <input readOnly value={state.ownerEmail || ""} />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              required
              type="password"
              autoComplete={setupMode ? "new-password" : "current-password"}
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 12 characters"
            />
          </label>

          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}

          <button
            className="button primary auth-submit"
            type="submit"
            disabled={pending}
          >
            {pending
              ? setupMode
                ? "Creating owner…"
                : "Signing in…"
              : setupMode
                ? "Create owner and continue"
                : "Sign in"}
          </button>
        </form>
      )}

      <p className="auth-footnote">
        Public registration is disabled at the application boundary. Grok account
        connection remains separate and is configured after sign-in.
      </p>
    </section>
  );
}
