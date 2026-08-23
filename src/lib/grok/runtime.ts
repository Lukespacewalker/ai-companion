import fs from "node:fs";
import path from "node:path";

export interface GrokRuntimePaths {
  grokHome: string;
  runtimeRoot: string;
  workspace: string;
}

export function getGrokRuntimePaths(): GrokRuntimePaths {
  const grokHome = path.resolve(
    process.env.GROK_HOME || path.join(process.cwd(), ".data", "grok"),
  );
  const runtimeRoot = path.resolve(
    process.env.COMPANION_RUNTIME_DIR ||
      path.join(process.cwd(), ".data", "runtime"),
  );
  const workspace = path.join(runtimeRoot, "grok-companion");

  fs.mkdirSync(grokHome, { recursive: true, mode: 0o700 });
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });

  return { grokHome, runtimeRoot, workspace };
}

export function getGrokEnvironment(): NodeJS.ProcessEnv {
  const { grokHome } = getGrokRuntimePaths();

  return {
    ...process.env,
    GROK_HOME: grokHome,
    NO_COLOR: "1",
    TERM: "dumb",
  };
}
