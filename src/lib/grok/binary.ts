import fs from "node:fs";
import path from "node:path";

export interface GrokBinary {
  command: string;
  prefixArgs: string[];
  display: string;
}

type PackageManifest = {
  bin?: string | Record<string, string>;
};

export function resolveGrokBinary(): GrokBinary | null {
  try {
    const packageFile = path.join(
      process.cwd(),
      "node_modules",
      "@xai-official",
      "grok",
      "package.json",
    );

    if (!fs.existsSync(packageFile)) {
      return null;
    }

    const manifest = JSON.parse(
      fs.readFileSync(packageFile, "utf8"),
    ) as PackageManifest;
    const binValue =
      typeof manifest.bin === "string"
        ? manifest.bin
        : manifest.bin?.grok || Object.values(manifest.bin || {})[0];

    if (!binValue) {
      return null;
    }

    const target = path.resolve(path.dirname(packageFile), binValue);
    const extension = path.extname(target).toLowerCase();
    const isJavaScript = [".js", ".mjs", ".cjs"].includes(extension);

    return isJavaScript
      ? {
          command: process.execPath,
          prefixArgs: [target],
          display: target,
        }
      : {
          command: target,
          prefixArgs: [],
          display: target,
        };
  } catch {
    return null;
  }
}
