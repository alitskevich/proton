import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { readJsonFiles } from "arrmatura-host/files";
import { capitalize } from "ultimus";
import { isRecord } from "../bundler/isRecord.ts";
import { docLines } from "./impl/docLines.ts";
import { itemsSource } from "./impl/itemsSource.ts";
import { literalBody } from "./impl/literalBody.ts";
import { writeGenerated } from "./impl/writeGenerated.ts";

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
 * - `nullable`, `required` (a field's boolean: `true` required, `false` the default), `default` (`.default`),
 *   `fallback` (`.catch`), `hint` (`.describe`).
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
  date: (arg) => `z.iso.datetime(${arg})`,
  isoDate: (arg) => `z.iso.date(${arg})`,
  email: (arg) => `z.email(${arg})`,
  url: (arg) => `z.url(${arg})`,
};

const NORMALIZERS = new Set(["trim", "toLowerCase", "toUpperCase"]);

const NAMED = ["primitive", "object", "enum"];

/** A form's field (display keys, or a `required` predicate) cannot be a data shape's. */
const isShape = ({ fields }: Struct) =>
  fields.every(
    (field) => !DISPLAY_KEYS.some((key) => key in field) && ["undefined", "boolean"].includes(typeof field.required),
  );

const typed = (exported: string) => ["", `export type T${exported.slice(1)} = z.infer<typeof ${exported}>;`];

/** The `{ items }` of `file`, each with a string at every key of `keys`; none when the file does not exist. */
const readItems = <T>(file: string, keys: string[]): T[] => {
  if (!existsSync(file)) return [];
  const text = readFileSync(posix.resolve(file), "utf8");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${file}: ${message}`, { cause: error });
  }
  const { items } = itemsSource(file, data);
  for (const item of items)
    if (keys.some((key) => typeof item[key] !== "string"))
      throw new Error(`${file}: every item needs ${keys.map((key) => `a string "${key}"`).join(" and ")}`);
  return items as T[];
};

/** `data` of `<name>.json` narrowed to a struct: its `fields`, each with a string `id`. */
const structOf = (name: string, data: unknown): Struct => {
  if (!isRecord(data) || !Array.isArray(data.fields) || !data.fields.every(isRecord))
    throw new Error(`${name}.json: expected { "fields": [...] }`);
  if (data.fields.some((field) => typeof field.id !== "string"))
    throw new Error(`${name}.json: every field needs a string "id"`);
  return data as Struct;
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
const namesOf = (spec: Spec) => [
  ...(spec.type && NAMED.includes(spec.type) && spec.typeSpec ? [spec.typeSpec] : []),
  ...(spec.type === "union" ? (spec.typeSpec ?? "").split("|") : []),
  ...(spec.refine ?? "").split("|").filter((step) => step && !NORMALIZERS.has(step)),
];

/**
 * Generates a Zod module from `.meta`: per custom primitive of `primitivesFile` and per data-shape struct of
 * `sourceDir`, `export const Z<Name>` and its `T<Name>`, ordered so every schema follows the ones it names. A struct is
 * `z.object({…})` (`z.looseObject`/`z.strictObject` when `loose`/`strict`), or `Z<Parent>.pick({…}).partial().extend({…})`
 * when it `extends`. A struct whose fields carry `Forma` display keys is a form: it throws, naming `.meta/forms`. `enum` specs import
 * `Z<TypeSpec>` from the enum module beside it (`generate-meta`), `refine` functions from their module. The importing
 * project provides `zod` and those modules. A malformed file throws, naming it.
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
  const primitives = new Map(readItems<Spec>(primitivesFile, ["id"]).map((primitive) => [primitive.id, primitive]));
  const functions = new Map(readItems<Fn>(functionsFile, ["id", "from"]).map((fn) => [fn.id, fn.from]));
  const structs = new Map(readJsonFiles(sourceDir).map(([name, data]) => [name, structOf(name, data)] as const));
  for (const [name, struct] of structs)
    if (!isShape(struct))
      throw new Error(`${name}.json: a form (Forma display keys or a non-boolean required): move it to .meta/forms`);
  for (const name of structs.keys())
    if (primitives.has(name)) throw new Error(`${name}: both a struct and a primitive`);
  const enums = new Set<string>();
  const used = new Set<string>();

  const unionPart = (where: string, part: string) => {
    if (structs.has(part) || primitives.has(part)) return `Z${capitalize(part)}`;
    const intrinsic = INTRINSIC[part] ?? FORMAT[part]?.("");
    if (!intrinsic) throw new Error(`${where}: union of unknown "${part}"`);
    return intrinsic;
  };

  /** The one value, normalised and limited, before list, map and `refine` checks. */
  const oneExpr = (where: string, spec: Spec, normalize: string) => {
    if (spec.const !== undefined) return `z.literal(${JSON.stringify(spec.const)})`;
    const typeSpec = spec.typeSpec ?? "";
    const format = spec.type === undefined ? undefined : FORMAT[spec.type];
    if (format) {
      if (spec.protocol !== undefined && spec.type !== "url") throw new Error(`${where}: protocol on a non-url`);
      const message = spec.message && spec.pattern === undefined ? JSON.stringify(spec.message) : "";
      const formatExpr = format(
        spec.protocol === undefined
          ? message
          : `{ protocol: /${literalBody(spec.protocol)}/${message ? `, error: ${message}` : ""} }`,
      );
      return normalize
        ? `z.string()${normalize}${limitCalls(spec)}.pipe(${formatExpr})`
        : `${formatExpr}${limitCalls(spec)}`;
    }
    if (spec.type === "union")
      return `z.union([${typeSpec
        .split("|")
        .map((part) => unionPart(where, part))
        .join(", ")}])`;
    const named = spec.type !== undefined && NAMED.includes(spec.type);
    if (!named && spec.type !== undefined && !INTRINSIC[spec.type])
      throw new Error(`${where}: unknown type "${spec.type}"`);
    if (named && !typeSpec) throw new Error(`${where}: type "${spec.type}" needs a typeSpec`);
    if (spec.type === "primitive" && !primitives.has(typeSpec)) throw new Error(`${where}: no primitive "${typeSpec}"`);
    if (spec.type === "object" && !structs.has(typeSpec)) throw new Error(`${where}: no struct "${typeSpec}"`);
    if (spec.type === "enum") enums.add(`Z${capitalize(typeSpec)}`);
    return `${named ? `Z${capitalize(typeSpec)}` : INTRINSIC[spec.type ?? "string"]}${normalize}${limitCalls(spec)}`;
  };

  const specExpr = (where: string, spec: Spec, field: boolean) => {
    const steps = (spec.refine ?? "").split("|").filter(Boolean);
    const lead = steps.findIndex((step) => !NORMALIZERS.has(step));
    const normalizers = lead === -1 ? steps : steps.slice(0, lead);
    const rest = lead === -1 ? [] : steps.slice(lead);
    if (rest.some((step) => NORMALIZERS.has(step)))
      throw new Error(`${where}: "${spec.refine}": a normaliser after a check`);
    const one = oneExpr(where, spec, normalizers.map((normalizer) => `.${normalizer}()`).join(""));
    const many = spec.isMap
      ? `z.record(z.string(), ${one})`
      : spec.isMulti
        ? `z.array(${one})${spec.minItems === undefined ? "" : `.min(${spec.minItems})`}${spec.maxItems === undefined ? "" : `.max(${spec.maxItems})`}`
        : one;
    const refined = rest
      .map((step) => {
        if (structs.has(step) || primitives.has(step)) return `.pipe(Z${capitalize(step)})`;
        if (!functions.has(step))
          throw new Error(`${where}: refine step "${step}" is no struct, primitive or function`);
        used.add(step);
        return `.transform((value) => ${step}(value))`;
      })
      .join("");
    return [
      many,
      refined,
      spec.nullable ? ".nullable()" : "",
      field && spec.required !== true && spec.default === undefined ? ".optional()" : "",
      spec.fallback === undefined ? "" : `.catch(${JSON.stringify(spec.fallback)})`,
      spec.default === undefined ? "" : `.default(${JSON.stringify(spec.default)})`,
      spec.hint ? `.describe(${JSON.stringify(spec.hint)})` : "",
    ].join("");
  };

  const primitiveLines = (primitive: Spec) => [
    ...docLines(primitive.$comment),
    `export const Z${capitalize(primitive.id)} = ${specExpr(`primitive ${primitive.id}`, primitive, false)};`,
    ...typed(`Z${capitalize(primitive.id)}`),
  ];

  const structLines = (name: string, struct: Struct) => {
    if (struct.extends && !structs.has(struct.extends))
      throw new Error(`${name}: extends no struct "${struct.extends}"`);
    const mode = struct.loose ? "looseObject" : struct.strict ? "strictObject" : "object";
    const pick = struct.pick ? `.pick({ ${struct.pick.map((key) => `${key}: true`).join(", ")} })` : "";
    const parent = struct.extends ? `Z${capitalize(struct.extends)}${pick}${struct.partial ? ".partial()" : ""}` : "";
    const head = struct.extends ? `${parent}.extend` : `z.${mode}`;
    const body = struct.fields
      .filter((field) => !field.$off)
      .flatMap((field) => [
        ...docLines(field.$comment, { indent: "  " }),
        `  ${field.id}: ${specExpr(`${name}.${field.id}`, field, true)},`,
      ]);
    const tail = struct.extends && struct.loose ? ".loose()" : struct.extends && struct.strict ? ".strict()" : "";
    const open = body.length
      ? [`export const Z${capitalize(name)} = ${head}({`, ...body, `})${tail};`]
      : [`export const Z${capitalize(name)} = ${head}({})${tail};`];
    return [...docLines(struct.description), ...open, ...typed(`Z${capitalize(name)}`)];
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
  const imports = [...fnImports, `import { z } from "zod";`].sort().join("\n");
  const enumImport = enums.size ? `import { ${[...enums].sort().join(", ")} } from "./schema.ts";\n` : "";

  writeGenerated({
    kind: "structs",
    sources: [`${sourceDir}/*.json`, primitivesFile, functionsFile],
    outFile,
    body: `${imports}\n${enumImport}\n${blocks.map((lines) => lines.join("\n")).join("\n\n")}`,
    count: `${primitives.size} + ${structs.size}`,
  });
}
