import { join, relative } from "node:path";
import { detect } from "../detect.js";
import { injectInto, updatePackageJson } from "../injector.js";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const LIME = "\x1b[38;5;191m";

export interface InitOptions {
  cwd: string;
  yes: boolean;
}

export async function runInit(opts: InitOptions): Promise<number> {
  console.log(`${LIME}${BOLD}sysko · init${RESET}`);
  console.log(`${DIM}analyzing ${opts.cwd}${RESET}\n`);

  let result;
  try {
    result = await detect(opts.cwd);
  } catch (err) {
    console.error(`${RED}error${RESET}  no package.json found in this directory`);
    console.error(`       run \`pnpm init\` first, or cd into your project`);
    return 1;
  }

  console.log(`  ${DIM}package${RESET}    ${result.pkgName}`);
  console.log(`  ${DIM}framework${RESET}  ${result.framework}`);
  console.log(`  ${DIM}entry${RESET}      ${result.entryFile ?? `${YELLOW}not detected${RESET}`}\n`);

  if (!result.entryFile) {
    console.error(`${RED}error${RESET}  could not find your entry file`);
    console.error(`       create one of: src/server.ts, src/index.ts, server.ts, index.ts`);
    console.error(`       or set \`main\` in package.json`);
    return 1;
  }

  if (!opts.yes) {
    console.log(`will do:`);
    console.log(`  ${LIME}+${RESET} add @sysko/core${result.framework === "express" || result.framework === "fastify" ? " and @sysko/plugins" : ""} to dependencies`);
    console.log(`  ${LIME}+${RESET} inject \`await init()\` at the top of ${result.entryFile}`);
    console.log(`\n${DIM}re-run with --yes to apply${RESET}\n`);
    return 0;
  }

  const pkgUpdate = await updatePackageJson(result.pkgJsonPath, result.framework);
  if (pkgUpdate.added.length > 0) {
    console.log(`${GREEN}✓${RESET} added to package.json: ${pkgUpdate.added.join(", ")}`);
  } else {
    console.log(`${DIM}·${RESET} package.json already has sysko deps`);
  }

  const entryPath = join(opts.cwd, result.entryFile);
  const inject = await injectInto(entryPath, {
    framework: result.framework,
    pkgName: result.pkgName,
  });
  if (inject.wrote) {
    console.log(`${GREEN}✓${RESET} patched ${relative(opts.cwd, entryPath)}`);
  } else {
    console.log(`${DIM}·${RESET} ${relative(opts.cwd, entryPath)} not patched: ${inject.reason ?? "unknown"}`);
  }

  console.log(`\n${BOLD}next${RESET}`);
  console.log(`  1. ${LIME}pnpm install${RESET}`);
  if (result.framework === "express" || result.framework === "fastify") {
    console.log(`  2. add ${LIME}instrument${result.framework === "express" ? "Express" : "Fastify"}(app)${RESET} after creating your app instance`);
    console.log(`  3. start your app and open ${LIME}http://localhost:9999${RESET}`);
  } else {
    console.log(`  2. start your app and open ${LIME}http://localhost:9999${RESET}`);
  }
  console.log("");
  return 0;
}
