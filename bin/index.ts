#!/usr/bin/env bun

/// <reference types="node" />
// `proton <script> [args]` runs `ops/<script>.ts` under Bun, or `ops/<script>.sh`, in the current
// directory. A project's npm scripts then name the script instead of its path:
//
//   "build:css": "proton build-css --minify"
//
// npm puts every `node_modules/.bin` up the tree on PATH, so a workspace package calls it the
// same way as its root. The script runs as its own process, not an import: some guard their
// entry with `import.meta.main`.

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FORWARDED = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

/**
 * Runs `bin` in place of the current process: same stdio, same exit code. A signal sent to this
 * process alone (a test runner or task manager stopping its server) is passed on, so the child
 * never outlives it; Ctrl+C in a terminal already reaches the whole group.
 */
export function runCommand(bin: string, args: string[]) {
  const child = spawn(bin, args, { stdio: "inherit" });
  for (const signal of FORWARDED) process.on(signal, () => child.kill(signal));
  child.on("error", (err) => {
    console.error(`❌ ${bin}: ${err.message}`);
    process.exit(1);
  });
  child.on("exit", (code) => process.exit(code ?? 1));
}

const ops = fileURLToPath(new URL("../ops/", import.meta.url));
const [name = "", ...args] = process.argv.slice(2);

const ts = `${ops}${name}.ts`;
const sh = `${ops}${name}.sh`;
const command = existsSync(ts) ? [process.execPath, ts] : existsSync(sh) ? [sh] : undefined;

if (!command) {
  const scripts = readdirSync(ops)
    .filter((file) => /\.(ts|sh)$/.test(file))
    .map((file) => file.replace(/\.(ts|sh)$/, ""))
    .sort();
  console.error(`Usage: proton <script> [args]\nScripts: ${scripts.join(", ")}`);
  process.exit(1);
}

const [bin, ...prefix] = command;
runCommand(bin, [...prefix, ...args]);
