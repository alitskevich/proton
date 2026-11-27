import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { readJsonFiles, writeFileContent } from "arrmatura-host/files";

/**
 * A value's spec: a struct field (with `id`) or a custom primitive (with `id`, never `required`).
 *
 * - `type`: none is a string; `boolean`/`number`/`int`/`date` (ISO datetime)/`isoDate`/`unknown`/`email`/`url` are
 *   intrinsic; `primitive`/`object`/`enum` name `typeSpec`; `union` names `a|b`, each a struct, a primitive or an
 *   intrinsic. `const` makes it that one literal value.
 * - `min`/`max` (inclusive), `exclusiveMin`/`exclusiveMax`, `pattern` (+ `message`, also a format's error), `protocol`
 *   (a `url`'s scheme pattern) limit the one value; `isMulti` (`minItems`, `maxItems`)
 *   makes it a list, `isMap` a string-keyed map.
 * - `refine`: a `|` pipe, left to right. `trim`/`toLowerCase`/`toUpperCase` come first and normalise the text before
 *   its limits and format; then a primitive or struct id is `.pipe(Z<Id>)` (a further check), and a function of the
 *   functions file is `.transform((value) => fn(value))`, both on the whole value.
 * - `nullable`, `required: true` (a field), `default` (`.default`), `fallback` (`.catch`), `hint` (`.describe`).
 */
type Spec = {
  id: string;
  type?: string;
  typeSpec?: string;
  const?: unknown;
  min?: number;
  max?: number;
  exclusiveMin?: number;
  exclusiveMax?: number;
  pattern?: string;
  protocol?: string;
  message?: string;
  isMulti?: boolean;
  minItems?: number;
  maxItems?: number;
  isMap?: boolean;
  refine?: string;
  nullable?: boolean;
  required?: unknown;
  default?: unknown;
  fallback?: unknown;
  hint?: string;
  $comment?: string;
  $off?: boolean;
};

/**
 * A `<name>.json` struct: `extends` another struct (only its `pick`ed fields, all optional when `partial`), then its
 * own fields; `loose` keeps unknown keys, `strict` rejects them.
 */
type Struct = {
  description?: string;
  loose?: boolean;
  strict?: boolean;
  extends?: string;
  pick?: string[];
  partial?: boolean;
  fields: Spec[];
};

/** A function a `refine` step may name, and the module that exports it. */
type Fn = { id: string; from: string };

/** The keys only a `Forma` form shows: a struct with any of them is a form, which belongs in `.meta/forms`. */
const DISPLAY_KEYS = ["name", "tab", "group", "width", "hidden", "disabled", "placeholder", "visible"];

const INTRINSIC: Record<string, string> = {
  string: "z.string()",
  number: "z.number()",
  int: "z.int()",
  boolean: "z.boolean()",
  unknown: "z.unknown()",
};

/** The string formats: their schema, given its argument (an error message, or a `url`'s options). */
const FORMAT: Record<string, (arg: string) => string> = {
  date: (a) => `z.iso.datetime(${a})`,
  isoDate: (a) => `z.iso.date(${a})`,
  email: (a) => `z.email(${a})`,
  url: (a) => `z.url(${a})`,
};

const NORMALIZERS = new Set(["trim", "toLowerCase", "toUpperCase"]);

const NAMED = ["primitive", "object", "enum"];

const pascal = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const doc = (text: string | undefined, indent = "") =>
  text ? [`${indent}/**`, ...text.split("\n").map((l) => `${indent} * ${l}`), `${indent} */`] : [];

const isShape = ({ fields }: Struct) =>
  fields.every((f) => !DISPLAY_KEYS.some((k) => k in f) && (f.required === undefined || f.required === true));

const typed = (exported: string) => ["", `export type T${exported.slice(1)} = z.infer<typeof ${exported}>;`];

/** The pattern as a regex literal body: a `/` outside a character class and not yet escaped gets its `\`. */
const literalBody = (pattern: string) => {
  let inClass = false;
  return [...pattern]
    .map((c, i) => {
      const escaped = pattern[i - 1] === "\\";
      if (!escaped && c === "[") inClass = true;
      if (!escaped && c === "]") inClass = false;
      return c === "/" && !escaped && !inClass ? "\\/" : c;
    })
    .join("");
};

const limitCalls = ({ min, max, exclusiveMin, exclusiveMax, pattern, message }: Spec) =>
  [
    min === undefined ? "" : `.min(${min})`,
    exclusiveMin === undefined ? "" : `.gt(${exclusiveMin})`,
    max === undefined ? "" : `.max(${max})`,
    exclusiveMax === undefined ? "" : `.lt(${exclusiveMax})`,
    pattern === undefined ? "" : `.regex(/${literalBody(pattern)}/${message ? `, ${JSON.stringify(message)}` : ""})`,
  ].join("");

/** The ids a spec names: its type, its union members, its `refine` checks. */
const namesOf = (s: Spec) => [
  ...(s.type && NAMED.includes(s.type) && s.typeSpec ? [s.typeSpec] : []),
  ...(s.type === "union" ? (s.typeSpec ?? "").split("|") : []),
  ...(s.refine ?? "").split("|").filter((step) => step && !NORMALIZERS.has(step)),
];

/**
 * Generates a Zod module from `.meta`: per custom primitive of `primitivesFile` and per data-shape struct of
 * `sourceDir`, `export const Z<Name>` and its `T<Name>`, ordered so every schema follows the ones it names. A struct is
 * `z.object({…})` (`z.looseObject`/`z.strictObject` when `loose`/`strict`), or `Z<Parent>.pick({…}).partial().extend({…})`
 * when it `extends`. A struct whose fields carry `Forma` display keys is a form: it throws, naming `.meta/forms`. `enum` specs import
 * `Z<TypeSpec>` from the enum module beside it (`generate-enums`), `refine` functions from their module. The importing
 * project provides `zod` and those modules.
 *
 * @param sourceDir The folder of `.json` structs (`{ fields }`), scanned flat.
 * @param primitivesFile The `{ items: Spec[] }` file of custom primitives; none when it does not exist.
 * @param functionsFile The `{ items: Fn[] }` file of the functions `refine` may name; none when it does not exist.
 * @param outFile Destination module; an enum module `schema.ts` sits beside it.
 */
export function generateStructs({
  sourceDir,
  primitivesFile,
  functionsFile,
  outFile,
}: {
  sourceDir: string;
  primitivesFile: string;
  functionsFile: string;
  outFile: string;
}) {
  const read = <T>(file: string) =>
    existsSync(file) ? (JSON.parse(readFileSync(posix.resolve(file), "utf8")) as { items: T[] }).items : [];
  const primitives = new Map(read<Spec>(primitivesFile).map((p) => [p.id, p]));
  const functions = new Map(read<Fn>(functionsFile).map((f) => [f.id, f.from]));
  const structs = new Map(readJsonFiles(sourceDir).map(([name, s]) => [name, s as Struct] as const));
  for (const [name, s] of structs)
    if (!isShape(s))
      throw new Error(`${name}.json: a form (Forma display keys or a non-boolean required): move it to .meta/forms`);
  for (const name of structs.keys())
    if (primitives.has(name)) throw new Error(`${name}: both a struct and a primitive`);
  const enums = new Set<string>();
  const used = new Set<string>();

  const unionPart = (where: string, part: string) => {
    if (structs.has(part) || primitives.has(part)) return `Z${pascal(part)}`;
    const intrinsic = INTRINSIC[part] ?? FORMAT[part]?.("");
    if (!intrinsic) throw new Error(`${where}: union of unknown "${part}"`);
    return intrinsic;
  };

  /** The one value, normalised and limited, before list, map and `refine` checks. */
  const oneExpr = (where: string, s: Spec, normalize: string) => {
    if (s.const !== undefined) return `z.literal(${JSON.stringify(s.const)})`;
    const spec = s.typeSpec ?? "";
    const format = s.type === undefined ? undefined : FORMAT[s.type];
    if (format) {
      if (s.protocol !== undefined && s.type !== "url") throw new Error(`${where}: protocol on a non-url`);
      const message = s.message && s.pattern === undefined ? JSON.stringify(s.message) : "";
      const fmt = format(
        s.protocol === undefined
          ? message
          : `{ protocol: /${literalBody(s.protocol)}/${message ? `, error: ${message}` : ""} }`,
      );
      return normalize ? `z.string()${normalize}${limitCalls(s)}.pipe(${fmt})` : `${fmt}${limitCalls(s)}`;
    }
    if (s.type === "union")
      return `z.union([${spec
        .split("|")
        .map((p) => unionPart(where, p))
        .join(", ")}])`;
    const named = s.type !== undefined && NAMED.includes(s.type);
    if (!named && s.type !== undefined && !INTRINSIC[s.type]) throw new Error(`${where}: unknown type "${s.type}"`);
    if (named && !spec) throw new Error(`${where}: type "${s.type}" needs a typeSpec`);
    if (s.type === "primitive" && !primitives.has(spec)) throw new Error(`${where}: no primitive "${spec}"`);
    if (s.type === "object" && !structs.has(spec)) throw new Error(`${where}: no struct "${spec}"`);
    if (s.type === "enum") enums.add(`Z${pascal(spec)}`);
    return `${named ? `Z${pascal(spec)}` : INTRINSIC[s.type ?? "string"]}${normalize}${limitCalls(s)}`;
  };

  const specExpr = (where: string, s: Spec, field: boolean) => {
    const steps = (s.refine ?? "").split("|").filter(Boolean);
    const lead = steps.findIndex((step) => !NORMALIZERS.has(step));
    const normalizers = lead === -1 ? steps : steps.slice(0, lead);
    const rest = lead === -1 ? [] : steps.slice(lead);
    if (rest.some((step) => NORMALIZERS.has(step)))
      throw new Error(`${where}: "${s.refine}": a normaliser after a check`);
    const one = oneExpr(where, s, normalizers.map((n) => `.${n}()`).join(""));
    const many = s.isMap
      ? `z.record(z.string(), ${one})`
      : s.isMulti
        ? `z.array(${one})${s.minItems === undefined ? "" : `.min(${s.minItems})`}${s.maxItems === undefined ? "" : `.max(${s.maxItems})`}`
        : one;
    const refined = rest
      .map((step) => {
        if (structs.has(step) || primitives.has(step)) return `.pipe(Z${pascal(step)})`;
        if (!functions.has(step))
          throw new Error(`${where}: refine step "${step}" is no struct, primitive or function`);
        used.add(step);
        return `.transform((value) => ${step}(value))`;
      })
      .join("");
    return [
      many,
      refined,
      s.nullable ? ".nullable()" : "",
      field && s.required !== true && s.default === undefined ? ".optional()" : "",
      s.fallback === undefined ? "" : `.catch(${JSON.stringify(s.fallback)})`,
      s.default === undefined ? "" : `.default(${JSON.stringify(s.default)})`,
      s.hint ? `.describe(${JSON.stringify(s.hint)})` : "",
    ].join("");
  };

  const primitiveLines = (p: Spec) => [
    ...doc(p.$comment),
    `export const Z${pascal(p.id)} = ${specExpr(`primitive ${p.id}`, p, false)};`,
    ...typed(`Z${pascal(p.id)}`),
  ];

  const structLines = (name: string, s: Struct) => {
    if (s.extends && !structs.has(s.extends)) throw new Error(`${name}: extends no struct "${s.extends}"`);
    const mode = s.loose ? "looseObject" : s.strict ? "strictObject" : "object";
    const parent = s.extends
      ? `Z${pascal(s.extends)}${s.pick ? `.pick({ ${s.pick.map((k) => `${k}: true`).join(", ")} })` : ""}${s.partial ? ".partial()" : ""}`
      : "";
    const head = s.extends ? `${parent}.extend` : `z.${mode}`;
    const body = s.fields
      .filter((f) => !f.$off)
      .flatMap((f) => [...doc(f.$comment, "  "), `  ${f.id}: ${specExpr(`${name}.${f.id}`, f, true)},`]);
    const tail = s.extends && s.loose ? ".loose()" : s.extends && s.strict ? ".strict()" : "";
    const open = body.length
      ? [`export const Z${pascal(name)} = ${head}({`, ...body, `})${tail};`]
      : [`export const Z${pascal(name)} = ${head}({})${tail};`];
    return [...doc(s.description), ...open, ...typed(`Z${pascal(name)}`)];
  };

  const blocks: string[][] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (name: string) => {
    if (state.get(name) === "done") return;
    if (state.get(name) === "visiting") throw new Error(`${name}: a cycle`);
    state.set(name, "visiting");
    const primitive = primitives.get(name);
    const struct = structs.get(name);
    const deps = primitive ? namesOf(primitive) : [struct?.extends, ...(struct?.fields ?? []).flatMap(namesOf)];
    for (const dep of deps) if (dep && (primitives.has(dep) || structs.has(dep))) visit(dep);
    state.set(name, "done");
    if (primitive) blocks.push(primitiveLines(primitive));
    else if (struct) blocks.push(structLines(name, struct));
  };
  for (const name of primitives.keys()) visit(name);
  for (const name of [...structs.keys()].sort()) visit(name);

  const fnImports = Object.entries(Object.groupBy([...used].sort(), (fn) => functions.get(fn) ?? "")).map(
    ([from, fns]) => `import { ${(fns ?? []).join(", ")} } from "${from}";`,
  );

  writeFileContent(
    posix.resolve(outFile),
    `// GENERATED by \`proton generate-meta\` from \`${sourceDir}/*.json\`, \`${primitivesFile}\` and \`${functionsFile}\` — do not edit.
${[...fnImports, `import { z } from "zod";`].sort().join("\n")}
${enums.size ? `import { ${[...enums].sort().join(", ")} } from "./schema.ts";\n` : ""}
${blocks.map((lines) => lines.join("\n")).join("\n\n")}
`,
  );

  console.log(
    `Generate structs: ${sourceDir} + ${primitivesFile} -> ${outFile} (${primitives.size} + ${structs.size})`,
  );
}
