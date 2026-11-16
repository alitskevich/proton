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

import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runCommand } from "./utils/runCommand";

const ops = fileURLToPath(new URL(".", import.meta.url));
const [name = "", ...args] = process.argv.slice(2);

const ts = `${ops}${name}.ts`;
const sh = `${ops}${name}.sh`;
const command = name !== "cli" && existsSync(ts) ? [process.execPath, ts] : existsSync(sh) ? [sh] : undefined;

if (!command) {
  const scripts = readdirSync(ops)
    .filter((file) => /\.(ts|sh)$/.test(file) && file !== "cli.ts")
    .map((file) => file.replace(/\.(ts|sh)$/, ""))
    .sort();
  console.error(`Usage: proton <script> [args]\nScripts: ${scripts.join(", ")}`);
  process.exit(1);
}

const [bin, ...prefix] = command;
runCommand(bin, [...prefix, ...args]);
