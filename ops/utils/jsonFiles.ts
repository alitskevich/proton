import { readFileSync, watch } from "node:fs";
import { posix } from "node:path";
import { mapDirectoryFiles } from "./mapDirectoryFiles";

/**
 * Every `<name>.json` in `dir`, scanned flat and sorted by file name, as `[name, parsed]`. A name
 * that is not a valid identifier or a file that does not parse throws, naming the file.
 */
export function readJsonFiles(dir: string): [name: string, data: unknown][] {
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
