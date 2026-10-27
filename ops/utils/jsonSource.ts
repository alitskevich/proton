type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isObject = (v: Json): v is { [key: string]: Json } => !!v && typeof v === "object" && !Array.isArray(v);

/** A `$comment` text as `//` lines; any other `$`-key is a comment too, its name only keeping it unique. */
const commentLines = (text: Json) => String(text).split("\n").map((l) => `// ${l}`);

/**
 * `value` as source, laid out as `JSON.stringify(value, null, 2)` lays it out — byte for byte when no
 * `$`-key appears. `$`-keys are notes for the source, not data: a `$`-key of an object becomes a `//`
 * line where it stands, and an array item with `$off: true` is written commented out.
 */
export function jsonSource(value: Json, indent = ""): string {
  const inner = `${indent}  `;
  const block = (open: string, close: string, parts: { value?: string; lines?: string[] }[]) => {
    const last = parts.findLastIndex((p) => p.value !== undefined);
    const body = parts.flatMap((p, i) => p.lines ?? [`${p.value}${i < last ? "," : ""}`]);
    return body.length ? `${open}\n${body.map((l) => inner + l).join("\n")}\n${indent}${close}` : open + close;
  };

  if (Array.isArray(value)) {
    return block(
      "[",
      "]",
      value.map((item) => {
        if (!isObject(item) || !item.$off) return { value: jsonSource(item, inner) };
        const { $off, ...rest } = item;
        return { lines: `${jsonSource(rest, inner)},`.split("\n").map((l, i) => `// ${i ? l.slice(inner.length) : l}`) };
      })
    );
  }
  if (isObject(value)) {
    return block(
      "{",
      "}",
      Object.entries(value).map(([key, v]) =>
        key.startsWith("$") ? { lines: commentLines(v) } : { value: `${JSON.stringify(key)}: ${jsonSource(v, inner)}` }
      )
    );
  }
  return JSON.stringify(value);
}
