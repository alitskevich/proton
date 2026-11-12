import { existsSync, readFileSync } from "node:fs";

/** The parsed JSON of a file, or `fallback` when it is absent or not JSON. */
export function readFileJsonContent(file: string, fallback: unknown = null): unknown {
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  try {
    return text && text !== "undefined" ? JSON.parse(text) : fallback;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error parsing JSON: ${message}`);
    return fallback;
  }
}
