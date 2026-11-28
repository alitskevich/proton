/// <reference types="node" />
// `arrmatura-support check-folder-structure [--fix]` fails when a function file sits off its home, by the
// Code Folder structure of the `arrmatura` skill (arrmatura-web `skills/arrmatura/docs/app-structure.md`):
//
//   "check:folders": "arrmatura-support check-folder-structure"
//
// A function file exports one function named after the file. It is public, and lives at `<dir>/<name>.ts`, when
// `<dir>/index.ts` imports it, a package.json names it, or code outside `<dir>` imports it (by relative path or
// by a package's name). Otherwise it is internal, and lives at `<dir>/impl/<name>.ts`. Tests never make a file
// public. `--fix` moves each file with `git mv` and repoints every path to it, and every relative path in it.

import { existsSync, readdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, normalize, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

/** Folders that hold no source of the project: installed, built, or another tool's. */
const SKIP = new Set(["node_modules", "dist", "www", "build", "coverage", "graphify-out", "out"]);
const SOURCE = /\.(ts|tsx|js|mjs|cjs|jsx)$/;
/** Files with a home of their own: barrels, rails files, generated registries, entries. */
const NOT_FUNCTION = new Set(["index", "consts", "schema", "types", "registry", "components", "functions", "main"]);
/** A quoted path: relative (`./x`, `../x`) or by a package's name (`pkg/x`). */
const QUOTED = /(["'])([^"'\n\s]+)\1/g;
const EXPORT =
  /^export\s+(?:declare\s+)?(async\s+function\*?|function\*?|const|let|class|type|interface|enum|default|\{|\*)\s*([\w$]*)/gm;
const LOCATED = /import\.meta\.dirname|import\.meta\.dir\b|__dirname/;

const { values } = parseArgs({ options: { fix: { type: "boolean" } } });
const top = resolve(process.cwd());

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

const all = walk(top);
const allSet = new Set(all);
const code = all.filter((file) => SOURCE.test(file) && !file.endsWith(".d.ts"));
const dirs = new Set(all.map(dirname));
const isTest = (file: string) => /(^|\/)tests?\//.test(relative(top, file)) || /\.(test|spec|e2e)\.tsx?$/.test(file);

type Package = { name?: string } & Record<string, unknown>;
const manifests = all.filter((file) => basename(file) === "package.json");
const packages = new Map<string, string>();
const named = new Set<string>();
for (const file of manifests) {
  const text = readFileSync(file, "utf8");
  const pkg: Package = JSON.parse(text);
  if (pkg.name) packages.set(pkg.name, dirname(file));
  for (const match of text.matchAll(/"(\.\/[^"]+\.tsx?)"/g)) named.add(join(dirname(file), match[1]));
}

/** The package a `pkg/sub/path` specifier names, and the sub path: the longest package name wins. */
function packageOf(spec: string): { root: string; name: string; sub: string } | undefined {
  const names = [...packages.keys()].filter((name) => spec.startsWith(`${name}/`));
  const name = names.sort((a, b) => b.length - a.length)[0];
  return name ? { root: packages.get(name) ?? "", name, sub: spec.slice(name.length + 1) } : undefined;
}

/** The file a specifier resolves to, from `fromDir`, among the files found before any move. */
function resolveSpec(fromDir: string, spec: string): string | undefined {
  const pkg = spec.startsWith(".") ? undefined : packageOf(spec);
  if (!spec.startsWith(".") && !pkg) return undefined;
  const base = pkg ? join(pkg.root, pkg.sub) : normalize(join(fromDir, spec));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
  return candidates.find((candidate) => allSet.has(candidate));
}

/** Whether a file exports exactly one value: a function named after the file. */
function isFunctionFile(file: string): boolean {
  const name = basename(file).replace(/\.ts$/, "");
  if (!file.endsWith(".ts") || NOT_FUNCTION.has(name) || !/^[a-z]/.test(name) || isTest(file)) return false;
  const text = readFileSync(file, "utf8");
  if (text.slice(0, 300).includes("GENERATED")) return false;
  const exported = [...text.matchAll(EXPORT)].filter(([, kind]) => !kind.startsWith("type") && kind !== "interface");
  if (exported.length !== 1) return false;
  const [, kind, exportName] = exported[0];
  if (exportName !== name) return false;
  if (kind.includes("function")) return true;
  const arrow = new RegExp(`export const ${name}\\b[^=]*=\\s*(async\\s*)?(\\(|[\\w$]+\\s*=>|function)`);
  return kind === "const" && arrow.test(text);
}

const importers = new Map<string, Set<string>>();
for (const file of code) {
  for (const match of readFileSync(file, "utf8").matchAll(QUOTED)) {
    const target = resolveSpec(dirname(file), match[2]);
    if (!target || target === file) continue;
    const set = importers.get(target) ?? new Set<string>();
    importers.set(target, set.add(file));
  }
}

/** Where a function file belongs: public beside `<dir>/index.ts`, or internal in `<dir>/impl/`. */
function homeOf(file: string, users: Set<string>): string {
  const parent = dirname(file);
  const dir = basename(parent) === "impl" ? dirname(parent) : parent;
  const inside = (user: string) => {
    const from = dirname(user);
    return (
      from === dir || [join(dir, "impl"), join(dir, "test")].some((sub) => `${from}${sep}`.startsWith(`${sub}${sep}`))
    );
  };
  const outsideUse = [...users].some((user) => !isTest(user) && !inside(user));
  const isPublic = named.has(file) || users.has(join(dir, "index.ts")) || outsideUse;
  const fileName = basename(file);
  return isPublic ? join(dir, fileName) : join(dir, "impl", fileName);
}

const moves = new Map<string, string>();
const unused: string[] = [];
const clashes: string[] = [];
for (const file of code.filter(isFunctionFile)) {
  const users = importers.get(file) ?? new Set<string>();
  if (!users.size && !named.has(file)) {
    unused.push(file);
    continue;
  }
  const home = homeOf(file, users);
  if (home === file) continue;
  if (existsSync(home)) clashes.push(`${relative(top, file)} → ${relative(top, home)} (taken)`);
  else moves.set(file, home);
}

const dotted = (path: string) => (path.startsWith(".") ? path : `./${path}`);

/** The specifier that reaches `target` from `fromDir`, in the form `spec` had: extension, package name. */
function respell(spec: string, target: string, fromDir: string): string {
  const keepExt = /\.tsx?$/.test(spec);
  const pkg = spec.startsWith(".") ? undefined : packageOf(spec);
  const path = pkg ? relative(pkg.root, target) : dotted(relative(fromDir, target));
  const bare = keepExt ? path : path.replace(/\.tsx?$/, "");
  return pkg ? `${pkg.name}/${bare}` : bare;
}

/** A file's text with every path repointed: to a moved file, or from a moved file's new folder. */
function rewrite(file: string): string {
  const text = readFileSync(file, "utf8");
  const oldDir = dirname(file);
  const newDir = dirname(moves.get(file) ?? file);
  return text.replace(QUOTED, (whole, quote: string, spec: string) => {
    const target = resolveSpec(oldDir, spec);
    const moved = target && moves.get(target);
    if (moved) return `${quote}${respell(spec, moved, newDir)}${quote}`;
    if (oldDir === newDir || !spec.startsWith(".")) return whole;
    const raw = normalize(join(oldDir, spec));
    const exists =
      allSet.has(raw) || dirs.has(raw) || [".ts", ".tsx", ".js", ".json"].some((ext) => allSet.has(raw + ext));
    if (!exists) return whole;
    const trailing = spec.endsWith("/") ? "/" : "";
    return `${quote}${dotted(relative(newDir, raw))}${trailing}${quote}`;
  });
}

function fix() {
  const edits = new Map(code.map((file) => [file, rewrite(file)]));
  for (const [from, to] of moves) {
    const git = Bun.spawnSync(["git", "mv", "-k", from, to], { cwd: top });
    if (git.exitCode !== 0 || existsSync(from)) throw new Error(`git mv failed: ${relative(top, from)}`);
  }
  for (const [file, text] of edits) {
    const path = moves.get(file) ?? file;
    if (text !== readFileSync(path, "utf8")) writeFileSync(path, text);
  }
  for (const from of moves.keys()) {
    const dir = dirname(from);
    if (basename(dir) === "impl" && existsSync(dir) && !readdirSync(dir).length) rmdirSync(dir);
  }
}

const list = (files: Iterable<string>) => [...files].map((file) => `   ${relative(top, file)}`).join("\n");
const located = [...moves.keys()].filter((file) => LOCATED.test(readFileSync(file, "utf8")));

if (unused.length)
  console.warn(`⚠️ check-folder-structure: ${unused.length} function file(s) nothing imports:\n${list(unused)}`);
if (clashes.length)
  console.error(`❌ check-folder-structure: ${clashes.length} move(s) blocked:\n   ${clashes.join("\n   ")}`);

if (moves.size && values.fix) {
  fix();
  console.log(`✅ check-folder-structure: moved ${moves.size} file(s). Now run lint:fix (import order), then gates.`);
  if (located.length) console.warn(`⚠️ These build a path from their own folder; check it:\n${list(located)}`);
} else if (moves.size) {
  const lines = [...moves].map(([from, to]) => `   ${relative(top, from)} → ${relative(top, to)}`).join("\n");
  console.error(
    `❌ check-folder-structure: ${moves.size} function file(s) off their home (--fix moves them):\n${lines}`,
  );
}

const failed = clashes.length > 0 || (moves.size > 0 && !values.fix);
if (failed) process.exit(1);
if (!moves.size) console.log(`✅ check-folder-structure: every function file is at home (${code.length} source files)`);
