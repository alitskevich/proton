import { readFileSync, watch } from "node:fs";
import { posix } from "node:path";
import { mapDirectoryFiles } from "./mapDirectoryFiles";

/** `<key>:<lang>` — a translation of `<key>`, written beside it. */
const TRANSLATION = /^(.+):([a-z]{2})$/;

/** `node` with every `<key>:<lang>` translation dropped — the base language alone. */
function baseOf(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(baseOf);
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !TRANSLATION.test(key))
      .map(([key, value]) => [key, baseOf(value)])
  );
}

/**
 * The `lang` overlay of `node`: only its `<key>:<lang>` translations, each written as `<key>`. An
 * array item keeps its `id`, which matches it to the base item; a branch with no translation is
 * dropped, and so is `node` itself (`undefined`).
 */
function overlayOf(node: unknown, lang: string): unknown {
  if (Array.isArray(node)) {
    const items = node
      .map((item) => [item, overlayOf(item, lang)])
      .filter(([, own]) => own !== undefined)
      .map(([item, own]) => ({ id: item.id, ...own }));
    return items.length ? items : undefined;
  }
  if (!node || typeof node !== "object") return undefined;
  const own: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    const translation = TRANSLATION.exec(key);
    if (translation) {
      if (translation[2] === lang) own[translation[1]] = value;
    } else {
      const branch = overlayOf(value, lang);
      if (branch !== undefined) own[key] = branch;
    }
  }
  return Object.keys(own).length ? own : undefined;
}

/** `--overlay=<lang>` from `process.argv`: the language whose overlay a generator writes, else the base. */
export const overlayLang = () =>
  process.argv.find((a) => a.startsWith("--overlay="))?.slice("--overlay=".length) || undefined;

/**
 * Every `<name>.json` in `dir`, scanned flat and sorted by file name, as `[name, parsed]`. A name
 * that is not a valid identifier or a file that does not parse throws, naming the file.
 *
 * A text's translations sit beside it as `<key>:<lang>` (`"name": "7 days", "name:nl": "7 dagen"`).
 * Without `lang` they are dropped, leaving the base; with it, each file is its `lang` overlay — only
 * those translations, array items matched by `id` — and a file with none is left out.
 */
export function readJsonFiles(dir: string, lang?: string): [name: string, data: unknown][] {
  return readRawJsonFiles(dir)
    .map(([name, data]): [string, unknown] => [name, lang ? overlayOf(data, lang) : baseOf(data)])
    .filter(([, data]) => data !== undefined);
}

function readRawJsonFiles(dir: string): [name: string, data: unknown][] {
  const files = mapDirectoryFiles(
    posix.resolve(dir),
    (f): [string, unknown] | null => {
      if (!f.name.endsWith(".json")) return null;
      const name = f.name.slice(0, -".json".length);
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error(`${f.name}: not a valid identifier`);
      try {
        return [name, JSON.parse(readFileSync(posix.join(dir, f.name), "utf8"))];
      } catch (err: any) {
        throw new Error(`${f.name}: ${err.message || err}`);
      }
    },
    { recursive: false }
  );
  if (!files.length) throw new Error(`${dir}: no .json files`);
  return files;
}

/**
 * Runs `generate` once, then — when `process.argv` has `--watch` — again on every `.json` change in
 * `dir`. While watching, a failed run is reported and the watch goes on.
 */
export function generateFromJsonFiles(dir: string, generate: () => void) {
  generate();
  if (!process.argv.includes("--watch")) return;

  watch(dir, (_event, file) => {
    if (!file?.endsWith(".json")) return;
    try {
      generate();
    } catch (err: any) {
      console.error("❌ Error:", err.message || err);
    }
  });
  console.log("👀 watching…");
}
