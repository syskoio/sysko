import { readFile, writeFile } from "node:fs/promises";
import type { Framework } from "./detect.js";

export interface InjectionOptions {
  framework: Framework;
  pkgName: string;
}

const SYSKO_MARKER = "@syskoio/core";

function buildSnippet(opts: InjectionOptions): string {
  const lines: string[] = [];
  lines.push(`import { init } from "@syskoio/core";`);

  if (opts.framework === "express") {
    lines.push(`import { instrumentExpress } from "@syskoio/plugins/express";`);
  } else if (opts.framework === "fastify") {
    lines.push(`import { instrumentFastify } from "@syskoio/plugins/fastify";`);
  }

  lines.push("");
  lines.push(`await init({ serviceName: ${JSON.stringify(opts.pkgName)} });`);
  lines.push("");

  if (opts.framework === "express") {
    lines.push(`// after you create your express app, call:`);
    lines.push(`//   instrumentExpress(app);`);
  } else if (opts.framework === "fastify") {
    lines.push(`// after you create your fastify instance, call:`);
    lines.push(`//   instrumentFastify(app);`);
  }
  return lines.join("\n");
}

export async function injectInto(
  filePath: string,
  opts: InjectionOptions,
): Promise<{ wrote: boolean; reason?: string }> {
  const original = await readFile(filePath, "utf-8");
  if (original.includes(SYSKO_MARKER)) {
    return { wrote: false, reason: "file already references @syskoio/core" };
  }

  const snippet = buildSnippet(opts);
  let next: string;

  const shebang = original.startsWith("#!");
  if (shebang) {
    const idx = original.indexOf("\n");
    next = original.slice(0, idx + 1) + snippet + "\n" + original.slice(idx + 1);
  } else {
    next = snippet + "\n" + original;
  }

  await writeFile(filePath, next, "utf-8");
  return { wrote: true };
}

export async function updatePackageJson(
  pkgJsonPath: string,
  framework: Framework,
): Promise<{ added: string[] }> {
  const raw = await readFile(pkgJsonPath, "utf-8");
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    [k: string]: unknown;
  };
  pkg.dependencies = pkg.dependencies ?? {};

  const wanted: string[] = ["@syskoio/core"];
  if (framework === "express" || framework === "fastify") {
    wanted.push("@syskoio/plugins");
  }

  const added: string[] = [];
  for (const dep of wanted) {
    if (!pkg.dependencies[dep]) {
      pkg.dependencies[dep] = "^0.0.1";
      added.push(dep);
    }
  }

  if (added.length > 0) {
    await writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  }
  return { added };
}
