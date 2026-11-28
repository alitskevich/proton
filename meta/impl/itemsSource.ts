import { isRecord } from "ultimus";
import type { ItemsSource } from "../types.ts";

/** `data` read from `file` narrowed to `{ $comment?, items: [{…}, …] }`; anything else throws, naming the file. */
export function itemsSource(file: string, data: unknown): ItemsSource {
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isRecord))
    throw new Error(`${file}: expected { "items": [...] }`);
  return { $comment: typeof data.$comment === "string" ? data.$comment : undefined, items: data.items };
}
