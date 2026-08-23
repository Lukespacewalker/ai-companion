import { spawn } from "node:child_process";
import { getGrokEnvironment } from "./runtime";
import type { GrokBinary } from "./binary";

const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export interface GrokCommandResult {
  code: number | null;
  output: string;
  timedOut: boolean;
  error?: string;
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export async function runGrokCommand(
  binary: GrokBinary,
  args: string[],
  timeoutMs = 15_000,
): Promise<GrokCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(binary.command, [...binary.prefixArgs, ...args], {
      env: getGrokEnvironment(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: GrokCommandResult) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ ...result, output: stripAnsi(result.output).trim() });
    };

    const append = (chunk: unknown) => {
      output = `${output}${String(chunk)}`.slice(-128_000);
    };

    child.stdout?.on("data", append);
    child.stderr?.on("data", append);

    child.once("error", (error) => {
      finish({
        code: null,
        output,
        timedOut: false,
        error: error.message,
      });
    });

    child.once("exit", (code) => {
      finish({ code, output, timedOut: false });
    });

    timer = setTimeout(() => {
      child.kill();
      finish({ code: null, output, timedOut: true });
    }, timeoutMs);
  });
}
