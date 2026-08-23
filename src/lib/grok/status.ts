import { resolveGrokBinary } from "./binary";
import { runGrokCommand } from "./command";
import { grokDeviceLogin } from "./device-login";
import type { GrokProviderStatus } from "./types";

const AUTH_FAILURE_PATTERN =
  /not authenticated|no auth credentials|sign[\s-]?in required|run [`'"]?grok login|please log in|authentication required/i;

export function parseGrokModels(output: string): string[] {
  const bulletModels = [
    ...output.matchAll(
      /^\s*[*•-]\s+([^\s(]+)(?:\s+\((?:default|recommended)\))?\s*$/gim,
    ),
  ].map((match) => match[1]);

  return [...new Set(bulletModels)].filter(Boolean);
}

export async function getGrokProviderStatus(): Promise<GrokProviderStatus> {
  const binary = resolveGrokBinary();
  const login = grokDeviceLogin.snapshot() ?? undefined;

  if (!binary) {
    return {
      id: "grok-cli-oauth",
      state: "unavailable",
      installed: false,
      authenticated: false,
      authMode: "oauth-cli",
      deployment: "persistent-self-hosted",
      models: [],
      detail: "Install dependencies to make the official Grok runtime available.",
      login,
    };
  }

  const result = await runGrokCommand(
    binary,
    ["--no-auto-update", "models"],
    15_000,
  );

  if (result.error) {
    return {
      id: "grok-cli-oauth",
      state: "error",
      installed: true,
      authenticated: false,
      authMode: "oauth-cli",
      deployment: "persistent-self-hosted",
      binary: binary.display,
      models: [],
      detail: result.error,
      login,
    };
  }

  if (result.timedOut) {
    return {
      id: "grok-cli-oauth",
      state: "error",
      installed: true,
      authenticated: false,
      authMode: "oauth-cli",
      deployment: "persistent-self-hosted",
      binary: binary.display,
      models: [],
      detail: "The Grok runtime did not answer the model check in time.",
      login,
    };
  }

  const authenticated =
    result.code === 0 && !AUTH_FAILURE_PATTERN.test(result.output);

  if (!authenticated && login?.state === "authorizing") {
    return {
      id: "grok-cli-oauth",
      state: "authorizing",
      installed: true,
      authenticated: false,
      authMode: "oauth-cli",
      deployment: "persistent-self-hosted",
      binary: binary.display,
      models: [],
      detail: "Complete the device-code authorization in the browser.",
      login,
    };
  }

  return {
    id: "grok-cli-oauth",
    state: authenticated ? "ready" : "signed-out",
    installed: true,
    authenticated,
    authMode: "oauth-cli",
    deployment: "persistent-self-hosted",
    binary: binary.display,
    models: authenticated ? parseGrokModels(result.output) : [],
    detail: authenticated
      ? "Authentication is managed by the official Grok Build runtime."
      : result.output ||
        "Connect with the official Grok device-code login.",
    login,
  };
}
