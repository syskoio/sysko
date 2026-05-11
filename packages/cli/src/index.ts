#!/usr/bin/env node
import { runInit } from "./commands/init.js";

const HELP = `sysko · observability for Node.js

usage:
  sysko init [--yes]      analyze project and inject sysko tracing
  sysko --help            show this help

flags:
  --yes, -y               apply changes (without this, init is a dry run)
  --cwd <path>            run as if from <path> instead of process.cwd()

docs: https://github.com/your-org/sysko
`;

interface ParsedArgs {
  command: string | undefined;
  yes: boolean;
  cwd: string;
  help: boolean;
}

function parse(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    command: undefined,
    yes: false,
    cwd: process.cwd(),
    help: false,
  };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--help" || a === "-h") {
      args.help = true;
    } else if (a === "--yes" || a === "-y") {
      args.yes = true;
    } else if (a === "--cwd") {
      const next = rest[i + 1];
      if (next) {
        args.cwd = next;
        i++;
      }
    } else if (!args.command && a && !a.startsWith("-")) {
      args.command = a;
    }
  }
  return args;
}

async function main(): Promise<number> {
  const args = parse(process.argv);
  if (args.help || !args.command) {
    process.stdout.write(HELP);
    return args.help ? 0 : 1;
  }

  switch (args.command) {
    case "init":
      return await runInit({ cwd: args.cwd, yes: args.yes });
    default:
      console.error(`unknown command: ${args.command}\n`);
      process.stdout.write(HELP);
      return 1;
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
