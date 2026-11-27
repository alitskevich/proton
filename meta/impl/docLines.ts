/** A note as comment lines of generated source, each after `indent`: a doc comment, or `//` lines when `line`. */
export function docLines(note: unknown, { indent = "", line = false }: { indent?: string; line?: boolean } = {}) {
  if (!note) return [];
  const lines = String(note).split("\n");
  if (line) return lines.map((text) => `${indent}// ${text}`);
  return [`${indent}/**`, ...lines.map((text) => `${indent} * ${text}`), `${indent} */`];
}
