/// <reference types="node" />
// `arrmatura-support check-deps` fails when a package under the current directory imports a library of the libs
// folder (the one holding arrmatura-support, ~/Projects/libs) that it does not list. Such an import builds only on a
// stale link in node_modules: the next `npm install` prunes it, and the build fails with `Could not resolve`.
//
//   "check:deps": "arrmatura-support check-deps"
//
// A file belongs to its nearest package.json. A package counts as listing what it names in `dependencies`,
// `devDependencies` or `peerDependencies`, and what every package around it does: a workspace package
// sees its root's. A library run from `node_modules/<lib>/` in an npm script counts as an import.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Folders that hold no source of the package: installed, built, or another tool's. */
const SKIP = new Set(["node_modules", "dist", "www", ".git", ".tmp", "graphify-out", "coverage"]);
const SOURCE = /\.(ts|tsx|js|mjs)$/;

const libsDir = dirname(fileURLToPath(new URL("..", import.meta.url)));
const top = resolve(process.cwd());

type Package = { name?: string; scripts?: Record<string, string> } & Record<string, unknown>;
const readPackage = (dir: string): Package | undefined => {
  const file = join(dir, "package.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
};

const libs = readdirSync(libsDir)
  .map((dir) => readPackage(join(libsDir, dir))?.name)
  .filter((name): name is string => Boolean(name));
const names = libs.join("|");
const IMPORT = new RegExp(`(?:from\\s+|import\\(\\s*|require\\(\\s*)["'](${names})(?:/[^"']*)?["']`, "g");
const SCRIPT_PATH = new RegExp(`node_modules/(${names})/`, "g");

/** The libraries `dir`'s package may import: its own name, what it lists, and what the packages around it list. */
const listed = (dir: string): Set<string> => {
  const pkg = readPackage(dir) ?? {};
  const own = ["dependencies", "devDependencies", "peerDependencies"].flatMap((key) =>
    Object.keys((pkg[key] as Record<string, string> | undefined) ?? {}),
  );
  const parent = dirname(dir);
  // Up to the projects folder: a package.json above it (in the home folder) is no project's.
  const outer = parent !== dir && [top, dirname(libsDir)].some((root) => parent.startsWith(root)) ? listed(parent) : [];
  return new Set([...(pkg.name ? [pkg.name] : []), ...own, ...outer]);
};

/** Each package under `top` with the libraries it uses, each with the first file that uses it. */
const uses = new Map<string, Map<string, string>>();
const use = (pkgDir: string, lib: string, where: string) => {
  const libsUsed = uses.get(pkgDir) ?? new Map<string, string>();
  if (!libsUsed.has(lib)) libsUsed.set(lib, where);
  uses.set(pkgDir, libsUsed);
};

function walk(dir: string, pkgDir: string) {
  const pkg = readPackage(dir);
  const owner = pkg ? dir : pkgDir;
  for (const match of JSON.stringify(pkg?.scripts ?? {}).matchAll(SCRIPT_PATH)) use(owner, match[1], "package.json");
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, owner);
    else if (entry.isFile() && SOURCE.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      for (const match of readFileSync(path, "utf8").matchAll(IMPORT)) use(owner, match[1], relative(owner, path));
    }
  }
}

walk(top, top);

const missing = [...uses].flatMap(([pkgDir, libsUsed]) => {
  const have = listed(pkgDir);
  return [...libsUsed].filter(([lib]) => !have.has(lib)).map(([lib, where]) => ({ pkgDir, lib, where }));
});

if (missing.length) {
  console.error(`❌ check-deps: ${missing.length} library import(s) not listed in package.json:`);
  for (const { pkgDir, lib, where } of missing) {
    console.error(`   ${relative(top, pkgDir) || "."}: ${lib} (${where})`);
  }
  process.exit(1);
}

console.log(`✅ check-deps: every library import is listed (${uses.size} package(s) import libraries)`);
