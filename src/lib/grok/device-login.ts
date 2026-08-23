import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { resolveGrokBinary } from "./binary";
import { getGrokEnvironment } from "./runtime";
import { stripAnsi } from "./command";
import type { GrokDeviceLoginSnapshot } from "./types";

type ActiveLogin = {
  snapshot: GrokDeviceLoginSnapshot;
  child: ChildProcess;
  output: string;
};

function cleanUrl(value: string): string {
  return value.replace(/[),.;]+$/, "");
}

function extractChallenge(output: string): {
  verificationUrl?: string;
  userCode?: string;
} {
  const cleaned = stripAnsi(output);
  const verificationUrl = cleaned.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  const userCode =
    cleaned.match(
      /(?:device\s+code|user\s+code|enter\s+(?:this\s+)?code|code)\s*[:=]?\s*([A-Z0-9]{4,}(?:-[A-Z0-9]{2,})*)/i,
    )?.[1] ||
    cleaned.match(/\b([A-Z0-9]{4}(?:-[A-Z0-9]{4})+)\b/)?.[1];

  return {
    verificationUrl: verificationUrl
      ? cleanUrl(verificationUrl)
      : undefined,
    userCode: userCode?.toUpperCase(),
  };
}

class GrokDeviceLoginCoordinator {
  private active: ActiveLogin | null = null;

  snapshot(): GrokDeviceLoginSnapshot | null {
    return this.active ? { ...this.active.snapshot } : null;
  }

  async start(): Promise<GrokDeviceLoginSnapshot> {
    if (this.active?.snapshot.state === "authorizing") {
      return { ...this.active.snapshot };
    }

    const binary = resolveGrokBinary();
    if (!binary) {
      throw new Error(
        "The official @xai-official/grok runtime is not installed.",
      );
    }

    const snapshot: GrokDeviceLoginSnapshot = {
      id: randomUUID(),
      state: "authorizing",
      startedAt: new Date().toISOString(),
    };

    const child = spawn(
      binary.command,
      [...binary.prefixArgs, "--no-auto-update", "login", "--device-auth"],
      {
        env: getGrokEnvironment(),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const active: ActiveLogin = { snapshot, child, output: "" };
    this.active = active;

    const append = (chunk: unknown) => {
      if (this.active?.snapshot.id !== snapshot.id) {
        return;
      }

      active.output = `${active.output}${String(chunk)}`.slice(-16_000);
      const challenge = extractChallenge(active.output);
      active.snapshot = {
        ...active.snapshot,
        ...challenge,
        instructions: stripAnsi(active.output).trim().slice(-2_000),
      };
    };

    child.stdout?.on("data", append);
    child.stderr?.on("data", append);

    child.once("error", (error) => {
      if (this.active?.snapshot.id !== snapshot.id) {
        return;
      }

      active.snapshot = {
        ...active.snapshot,
        state: "failed",
        completedAt: new Date().toISOString(),
        error: error.message,
      };
    });

    child.once("exit", (code) => {
      if (this.active?.snapshot.id !== snapshot.id) {
        return;
      }

      const failed = code !== 0;
      active.snapshot = {
        ...active.snapshot,
        state: failed ? "failed" : "completed",
        completedAt: new Date().toISOString(),
        error: failed
          ? `Grok login exited with code ${code ?? "unknown"}.`
          : undefined,
      };
    });

    await this.waitForChallenge(snapshot.id, 6_000);
    return { ...active.snapshot };
  }

  cancel(): void {
    if (!this.active) {
      return;
    }

    if (this.active.snapshot.state === "authorizing") {
      this.active.child.kill();
      this.active.snapshot = {
        ...this.active.snapshot,
        state: "cancelled",
        completedAt: new Date().toISOString(),
      };
    }
  }

  clear(): void {
    this.cancel();
    this.active = null;
  }

  private async waitForChallenge(id: string, timeoutMs: number): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const current = this.active;
      if (!current || current.snapshot.id !== id) {
        return;
      }

      if (
        current.snapshot.verificationUrl ||
        current.snapshot.userCode ||
        current.snapshot.state !== "authorizing"
      ) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 75));
    }
  }
}

const globalForLogin = globalThis as typeof globalThis & {
  __aiCompanionGrokLogin?: GrokDeviceLoginCoordinator;
};

export const grokDeviceLogin =
  globalForLogin.__aiCompanionGrokLogin ??
  new GrokDeviceLoginCoordinator();

if (process.env.NODE_ENV !== "production") {
  globalForLogin.__aiCompanionGrokLogin = grokDeviceLogin;
}
