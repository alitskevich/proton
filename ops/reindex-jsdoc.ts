/**
 * Regenerates `index.md` from the JSDoc in `src/**`.
 *
 * Run: `proton reindex-jsdoc`, from the package root.
 *
 * Every exported symbol reachable from `index.ts` is listed with its parameter list
 * and the first sentence of its JSDoc, grouped by module. Undocumented exports are
 * listed too, marked so the gap is visible rather than silently missing.
 *
 * Inline doc tags configure it:
 * - `@example <one line>` in `./index.ts`: the import example of the intro;
 * - `@module <Title>` in each `src/<dir>/index.ts` that exports anything: the section
 *   title; the untagged text of that block is its one-line blurb. Sections sort by title.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { capitalize } from "ultimus";
import { readFileJsonContent } from "../utils-files/index.ts";

// The package root, i.e. the cwd.
const ROOT = process.cwd();
const SRC = join(ROOT, "src");

const DOC_BLOCK = /\/\*\*([\s\S]*?)\*\//g;

/**
 * The first doc block of `file` that carries `tag`: the tag's value, and the block's
 * untagged text joined into one line. null when no block carries it.
 */
const tagged = (file: string, tag: string): { value: string; text: string } | null => {
  if (!existsSync(file)) return null;
  for (const [, body] of readFileSync(file, "utf8").matchAll(DOC_BLOCK)) {
    const lines = body
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean);
    const value = lines
      .find((line) => line.startsWith(`${tag} `))
      ?.slice(tag.length)
      .trim();
    if (value) return { value, text: lines.filter((line) => !line.startsWith("@")).join(" ") };
  }
  return null;
};

const { name: PACKAGE } = readFileJsonContent(join(ROOT, "package.json"), {});
const EXAMPLE = tagged(join(ROOT, "index.ts"), "@example")?.value;
if (!PACKAGE || !EXAMPLE) throw new Error("needs a package.json `name` and an `@example <one line>` in index.ts");

/** Title and blurb of the `src/<dir>` module, from the `@module <Title>` doc block of its `index.ts`. */
const moduleDoc = (dir: string): { dir: string; title: string; blurb: string } => {
  const doc = tagged(join(SRC, dir, "index.ts"), "@module");
  if (!doc?.text) throw new Error(`src/${dir}/index.ts needs a doc block with \`@module <Title>\` and a blurb`);
  return { dir, title: doc.value, blurb: doc.text };
};

type Entry = {
  name: string;
  params: string;
  kind: "fn" | "const" | "type" | "class";
  doc: string;
  file: string;
};

/** Everything a file re-exports: `*` (all of it) or the explicit list of names. */
type Exposed = "*" | Set<string>;

const RE_EXPORT = /export\s+(?:type\s+)?(\*|\{([^}]*)\})\s*from\s*["']([^"']+)["']/g;

const resolveModule = (fromFile: string, spec: string): string | null =>
  [`${join(dirname(fromFile), spec)}.ts`, join(dirname(fromFile), spec, "index.ts")].find(existsSync) ?? null;

/**
 * The package's public surface: every file reachable from the entry via `export … from`,
 * mapped to the names it exposes. Files under `src/` that nothing re-exports are private
 * and stay out of the index (e.g. `SAMPLE` in dateParseISO8601.ts).
 */
const publicSurface = (entry: string): Map<string, Exposed> => {
  const surface = new Map<string, Exposed>();
  const walked = new Set<string>();

  const visit = (file: string, exposed: Exposed) => {
    const known = surface.get(file);
    if (known === "*" && walked.has(file)) return;
    surface.set(file, exposed === "*" || known === "*" ? "*" : new Set([...(known ?? []), ...exposed]));
    if (walked.has(file)) return;
    walked.add(file);

    for (const [, star, named = "", spec] of readFileSync(file, "utf8").matchAll(RE_EXPORT)) {
      const target = resolveModule(file, spec);
      if (!target) continue;
      const names =
        star === "*"
          ? ("*" as const)
          : new Set(
              named
                // A multi-line export list may carry `//` comments between names.
                .replace(/\/\/[^\n]*/g, "")
                .split(",")
                .map((part) =>
                  part
                    .trim()
                    .split(/\s+as\s+/)[0]
                    .replace(/^type\s+/, "")
                    .trim(),
                )
                .filter(Boolean),
            );
      visit(target, names);
    }
  };

  visit(entry, "*");
  return surface;
};

/** The `@deprecated` note of a JSDoc block, if it carries one. */
const deprecation = (block: string): string => {
  const tag = block.match(/@deprecated\s*([^\n*]*)/);
  return tag ? `**Deprecated.** ${tag[1].trim()}`.trim() : "";
};

/** First sentence of a JSDoc block, flattened to one line; "" when there is none. */
const firstSentence = (block: string): string => {
  const text = block
    .split("\n")
    .map((line) => line.replace(/^\s*\/?\*+\/?/, "").trim())
    // `@param` blocks and lint directives are not the summary.
    .filter((line) => line && !line.startsWith("@") && !line.includes("biome-ignore"))
    .join(" ")
    .trim();
  if (!text) return "";
  const stop = text.search(/\.\s|\.$/);
  const sentence = stop === -1 ? text : text.slice(0, stop + 1);
  return sentence.replace(/\s+/g, " ").replace(/\.$/, "");
};

/** Consumes a balanced `<…>` / `(…)` group at the start of `code`; "" when it does not open one. */
const balanced = (code: string, open: string, close: string): string => {
  if (code[0] !== open) return "";
  let depth = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === open) depth++;
    else if (code[i] === close && !--depth) return code.slice(0, i + 1);
  }
  return "";
};

/**
 * The parameter list of a declaration, or "" when it declares no function.
 *
 * Only a `(` that directly follows the name (or its `=`, `async`, and generics) counts —
 * scanning for the next `(` anywhere would give an alias like `export const min = Math.min`
 * the parameters of whatever function happens to follow it.
 */
const paramsAt = (code: string, from: number): string => {
  let rest = code
    .slice(from)
    .replace(/^\s*=\s*/, "")
    .replace(/^async\s+/, "");
  rest = rest.slice(balanced(rest, "<", ">").length).trimStart();
  return balanced(rest, "(", ")").replace(/\s+/g, " ");
};

/**
 * Splits a parameter list on top-level commas, ignoring those inside brackets or quotes.
 * The `>` of an arrow `=>` closes no bracket.
 */
const splitParams = (inner: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (const char of inner) {
    if (quote) {
      if (char === quote) quote = "";
    } else if (`"'\``.includes(char)) quote = char;
    else if ("([{<".includes(char)) depth++;
    else if (")]}>".includes(char) && !(char === ">" && current.endsWith("="))) depth--;
    else if (char === "," && !depth) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  return [...parts, current].map((part) => part.trim()).filter(Boolean);
};

/** Drops TS type annotations and defaults, keeping just the parameter names. */
const paramNames = (params: string): string => {
  const inner = params.slice(1, -1);
  if (!inner.trim()) return "()";
  const names = splitParams(inner).map((part) => {
    const optional = /\?\s*:/.test(part) || part.includes("=");
    // A destructured parameter keeps its shape: `{ a, b }` reads better than a mangled name.
    if (part.startsWith("{"))
      return `{ ${splitParams(part.slice(1, part.indexOf("}")))
        .map(keyOf)
        .join(", ")} }`;
    const name = keyOf(part);
    return optional && !name.startsWith("...") ? `${name}?` : name;
  });
  return `(${names.join(", ")})`;
};

/** The bare identifier of a parameter or destructured key, without type or default. */
function keyOf(part: string): string {
  return part.split(/[:=]/)[0].trim().replace(/\?$/, "");
}

// The JSDoc group forbids an inner `*/` and must sit on the line directly above the
// declaration — otherwise backtracking lets a file-header comment swallow the real one.
const DECLARATION =
  /(?:^|\n)((?:\/\*\*(?:(?!\*\/)[\s\S])*\*\/)[ \t]*\n(?:[ \t]*\/\/[^\n]*\n)*)?export\s+(?:declare\s+)?(const|function|type|class|interface)\s+([A-Za-z_$][\w$]*)/g;

const parseFile = (path: string, exposed: Exposed): Entry[] => {
  const code = readFileSync(path, "utf8");
  const entries: Entry[] = [];
  for (const match of code.matchAll(DECLARATION)) {
    const [, jsdoc = "", keyword, name] = match;
    if (exposed !== "*" && !exposed.has(name)) continue;
    const declarationStart = match.index + match[0].length;
    const kind = keyword === "type" || keyword === "interface" ? "type" : keyword === "class" ? "class" : "const";
    const params = kind === "const" ? paramsAt(code, declarationStart) : "";
    entries.push({
      name,
      params: params ? paramNames(params) : "",
      kind: params ? "fn" : kind,
      doc: deprecation(jsdoc) || firstSentence(jsdoc),
      file: relative(ROOT, path),
    });
  }
  return entries;
};

// --- collect ------------------------------------------------------------------

const surface = publicSurface(join(ROOT, "index.ts"));
const all = [...surface].flatMap(([file, exposed]) => (file.startsWith(SRC) ? parseFile(file, exposed) : []));
const byName = new Map<string, Entry>();
for (const entry of all) if (!byName.has(entry.name)) byName.set(entry.name, entry);

const moduleOf = (file: string) => file.replace(/^src\//, "").split("/")[0];
const grouped = new Map<string, Entry[]>();
for (const entry of byName.values()) {
  const key = entry.file.endsWith("types.ts") ? "types" : moduleOf(entry.file);
  grouped.set(key, [...(grouped.get(key) ?? []), entry]);
}

// --- render -------------------------------------------------------------------

const line = (entry: Entry) => {
  const signature = entry.kind === "fn" ? `${entry.name}${entry.params}` : entry.name;
  const doc = entry.doc || "_(undocumented)_";
  return `- \`${signature}\`${entry.kind === "type" ? " _(type)_" : ""} — ${doc}`;
};

const section = (title: string, blurb: string, entries: Entry[]) =>
  [`### ${title}`, "", blurb, "", ...entries.sort((a, b) => a.name.localeCompare(b.name)).map(line), ""].join("\n");

const modules = [...grouped.keys()]
  .filter((key) => key !== "types")
  .map(moduleDoc)
  .sort((a, b) => a.title.localeCompare(b.title));
const toc = modules.map(({ title }) => `- [${title}](#${title.toLowerCase()})`).join("\n");

const body = modules.map(({ dir, title, blurb }) => section(title, blurb, grouped.get(dir) ?? [])).join("\n");
const types = grouped.get("types") ?? [];

const out = `<!-- GENERATED by proton reindex-jsdoc — run \`npm run reindex\`. Do not edit by hand. -->
# ${capitalize(PACKAGE)} — index of exports

Every symbol exported from \`${PACKAGE}\`, grouped by module. Import all of them from the
package root: \`${EXAMPLE}\`

**Check this list before writing a helper.** Descriptions come from each symbol's JSDoc —
hover it in the editor for the full text, parameter notes and examples.

${toc}
- [Types](#types)

---

${body}### Types

Shared type aliases.

${types
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(line)
  .join("\n")}

---

_${byName.size} exports across ${modules.length} modules._
`;

writeFileSync(join(ROOT, "index.md"), out);
console.log(`index.md — ${byName.size} exports across ${modules.length} modules`);
