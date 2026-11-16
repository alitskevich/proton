/// <reference types="node" />
// `proton check-fresh <npm script> <file or glob>…` fails when running the script changes any of
// the files: the generated files in the tree were stale. A gate runs it first, so a stale index or
// catalog is reported instead of committed:
//
//   "check:fresh": "proton check-fresh codegen catalog.json 'modules/*/registry.ts'"
//
// The script's own result is left in place, so the fix is to commit it.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { globSync, readFileSync } from "node:fs";

const [script, ...patterns] = process.argv.slice(2);

if (!script || !patterns.length) {
  console.error("Usage: proton check-fresh <npm script> <file or glob>…");
  process.exit(1);
}

/** Every matched file with a hash of its content: a file that appears or goes away counts as a change. */
const snapshot = () => {
  const files = patterns.flatMap((pattern) => globSync(pattern)).sort();
  const entries = files.map((file) => [file, createHash("sha1").update(readFileSync(file)).digest("hex")]);
  return new Map(entries as [string, string][]);
};

const before = snapshot();
const run = spawnSync("npm", ["run", "--silent", script], { stdio: ["ignore", "ignore", "inherit"] });

if (run.status !== 0) {
  console.error(`❌ check-fresh: "npm run ${script}" failed`);
  process.exit(run.status ?? 1);
}

const after = snapshot();
const names = new Set([...before.keys(), ...after.keys()]);
const stale = [...names].filter((file) => before.get(file) !== after.get(file));

if (stale.length) {
  console.error(`❌ check-fresh: "npm run ${script}" changed ${stale.length} stale file(s) — commit the result:`);
  for (const file of stale) console.error(`   ${file}`);
  process.exit(1);
}

console.log(`✅ check-fresh: "npm run ${script}" changes nothing (${after.size} files)`);
