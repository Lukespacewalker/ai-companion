"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  GrokDeviceLoginSnapshot,
  GrokProviderStatus,
} from "@/lib/grok/types";

type StatusPayload = { provider: GrokProviderStatus };
type LoginPayload = { login: GrokDeviceLoginSnapshot };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      body.error || `Request failed with status ${response.status}.`,
    );
  }

  return body as T;
}

function stateLabel(state?: GrokProviderStatus["state"]): string {
  return {
    ready: "Connected",
    authorizing: "Waiting for authorization",
    "signed-out": "Not connected",
    unavailable: "Runtime unavailable",
    error: "Connection error",
  }[state ?? "signed-out"];
}

export function GrokProviderCard({
  initialProvider,
}: {
  initialProvider: GrokProviderStatus;
}) {
  const [provider, setProvider] = useState<GrokProviderStatus>(initialProvider);
  const [login, setLogin] = useState<GrokDeviceLoginSnapshot | null>(
    initialProvider.login ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { provider: next } = await requestJson<StatusPayload>(
        "/api/providers/grok/status",
      );
      setProvider(next);
      setLogin(next.login ?? null);
      setError("");
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  useEffect(() => {
    if (provider.state !== "authorizing") {
      return;
    }

    const timer = window.setInterval(() => void refresh(), 1_800);
    return () => window.clearInterval(timer);
  }, [provider.state, refresh]);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    setReply("");

    try {
      await action();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function connect() {
    void perform(async () => {
      const { login: challenge } = await requestJson<LoginPayload>(
        "/api/providers/grok/login",
        { method: "POST", body: "{}" },
      );
      setLogin(challenge);

      if (challenge.verificationUrl) {
        window.open(
          challenge.verificationUrl,
          "_blank",
          "noopener,noreferrer",
        );
      }

      setNotice(
        challenge.userCode
          ? `Enter device code ${challenge.userCode} in the opened page.`
          : "Complete authorization in the browser, then return here.",
      );
      await refresh();
    });
  }

  function disconnect() {
    void perform(async () => {
      const { provider: next } = await requestJson<StatusPayload>(
        "/api/providers/grok/logout",
        { method: "POST", body: "{}" },
      );
      setProvider(next);
      setLogin(null);
      setNotice("Grok Build signed out.");
    });
  }

  function testConnection() {
    void perform(async () => {
      const result = await requestJson<{ text: string }>(
        "/api/providers/grok/test",
        {
          method: "POST",
          body: JSON.stringify({
            prompt:
              "Reply with one short sentence confirming that the companion connection works.",
          }),
        },
      );
      setReply(result.text);
    });
  }

  function copyCode() {
    if (!login?.userCode) {
      return;
    }

    void navigator.clipboard.writeText(login.userCode);
    setNotice("Device code copied.");
  }

  const ready = provider.state === "ready";

  return (
    <section className="provider-card" aria-live="polite">
      <header className="provider-header">
        <div className="provider-name">
          <span className="provider-logo" aria-hidden="true">x</span>
          <div>
            <h2>Grok Build OAuth</h2>
            <p>Official device login through <code>@xai-official/grok</code></p>
          </div>
        </div>
        <span className={`state-chip ${provider.state}`}>
          <i />
          {stateLabel(provider.state)}
        </span>
      </header>

      <dl className="provider-facts">
        <div><dt>Authentication</dt><dd>CLI-managed OAuth session</dd></div>
        <div><dt>Deployment</dt><dd>Persistent self-hosted Node</dd></div>
        <div>
          <dt>Models</dt>
          <dd>
            {provider.models.length
              ? provider.models.slice(0, 4).join(", ")
              : "Available after connection"}
          </dd>
        </div>
      </dl>

      {provider.detail ? <p className="provider-detail">{provider.detail}</p> : null}

      {login?.verificationUrl && provider.state === "authorizing" ? (
        <div className="device-panel">
          <div>
            <span>Device code</span>
            <strong>{login.userCode || "Waiting…"}</strong>
          </div>
          <div className="actions">
            {login.userCode ? (
              <button className="button secondary small" onClick={copyCode} type="button">
                Copy
              </button>
            ) : null}
            <a
              className="button primary small"
              href={login.verificationUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open authorization
            </a>
          </div>
        </div>
      ) : null}

      <div className="actions provider-actions">
        {ready ? (
          <>
            <button className="button primary" disabled={busy} onClick={testConnection} type="button">
              {busy ? "Working…" : "Test reply"}
            </button>
            <button className="button secondary" disabled={busy} onClick={disconnect} type="button">
              Disconnect
            </button>
          </>
        ) : (
          <button
            className="button primary"
            disabled={busy || provider.state === "unavailable"}
            onClick={connect}
            type="button"
          >
            {busy ? "Starting…" : "Connect Grok"}
          </button>
        )}
        <button className="button ghost" disabled={busy} onClick={() => void refresh()} type="button">
          Refresh
        </button>
      </div>

      {notice ? <p className="notice success">{notice}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
      {reply ? (
        <blockquote className="test-reply">
          <span>Grok replied</span>
          {reply}
        </blockquote>
      ) : null}
    </section>
  );
}
