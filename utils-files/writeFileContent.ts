import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Writes trimmed text plus one final newline (what formatters expect of a generated file), creating missing parent directories; a promise is awaited first, `null` writes nothing. */
export function writeFileContent(file: string, content: string | Promise<string> | null): void | Promise<void> {
  if (content == null) return;
  if (content instanceof Promise) return content.then((text) => writeFileContent(file, text));
  if (typeof content === "string") {
    const parent = dirname(file);
    const text = `${content.trim()}\n`;
    mkdirSync(parent, { recursive: true });
    writeFileSync(file, text, "utf8");
  }
}
