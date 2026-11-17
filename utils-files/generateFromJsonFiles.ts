import { watch } from "node:fs";

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
