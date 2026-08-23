import { resolveGrokBinary } from "./binary";
import { runGrokCommand } from "./command";
import { grokDeviceLogin } from "./device-login";
import { generateWithGrokCli } from "./acp";
import { getGrokProviderStatus } from "./status";
import type {
  GrokDeviceLoginSnapshot,
  GrokGenerateRequest,
  GrokGenerateResult,
  GrokProviderStatus,
} from "./types";

export interface GrokProvider {
  status(): Promise<GrokProviderStatus>;
  startLogin(): Promise<GrokDeviceLoginSnapshot>;
  logout(): Promise<GrokProviderStatus>;
  generate(request: GrokGenerateRequest): Promise<GrokGenerateResult>;
}

class GrokCliOAuthProvider implements GrokProvider {
  status(): Promise<GrokProviderStatus> {
    return getGrokProviderStatus();
  }

  startLogin(): Promise<GrokDeviceLoginSnapshot> {
    return grokDeviceLogin.start();
  }

  async logout(): Promise<GrokProviderStatus> {
    grokDeviceLogin.clear();

    const binary = resolveGrokBinary();
    if (binary) {
      await runGrokCommand(
        binary,
        ["--no-auto-update", "logout"],
        15_000,
      );
    }

    return getGrokProviderStatus();
  }

  generate(request: GrokGenerateRequest): Promise<GrokGenerateResult> {
    return generateWithGrokCli(request);
  }
}

const globalForProvider = globalThis as typeof globalThis & {
  __aiCompanionGrokProvider?: GrokProvider;
};

export const grokProvider =
  globalForProvider.__aiCompanionGrokProvider ??
  new GrokCliOAuthProvider();

if (process.env.NODE_ENV !== "production") {
  globalForProvider.__aiCompanionGrokProvider = grokProvider;
}
