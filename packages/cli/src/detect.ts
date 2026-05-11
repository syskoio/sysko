import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export type Framework = "express" | "fastify" | "next" | "nestjs" | "generic";

export interface DetectionResult {
  framework: Framework;
  pkgName: string;
  entryFile: string | undefined;
  pkgJsonPath: string;
}

const ENTRY_CANDIDATES = [
  "src/server.ts",
  "src/index.ts",
  "src/main.ts",
  "src/app.ts",
  "server.ts",
  "index.ts",
  "main.ts",
  "app.ts",
  "src/server.js",
  "src/index.js",
  "src/main.js",
  "server.js",
  "index.js",
  "main.js",
];

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function frameworkFromDeps(deps: Record<string, string>): Framework {
  if (deps["next"]) return "next";
  if (deps["@nestjs/core"]) return "nestjs";
  if (deps["fastify"]) return "fastify";
  if (deps["express"]) return "express";
  return "generic";
}

export async function detect(cwd: string): Promise<DetectionResult> {
  const pkgJsonPath = join(cwd, "package.json");
  const raw = await readFile(pkgJsonPath, "utf-8");
  const pkg = JSON.parse(raw) as {
    name?: string;
    main?: string;
    module?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const framework = frameworkFromDeps(deps);

  let entry: string | undefined = pkg.main ?? pkg.module;
  if (entry && !(await exists(join(cwd, entry)))) entry = undefined;
  if (!entry) {
    for (const candidate of ENTRY_CANDIDATES) {
      if (await exists(join(cwd, candidate))) {
        entry = candidate;
        break;
      }
    }
  }

  return {
    framework,
    pkgName: pkg.name ?? "app",
    entryFile: entry,
    pkgJsonPath,
  };
}
