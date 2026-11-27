import { readJsonFiles } from "arrmatura-host/files";
import { docLines } from "./impl/docLines.ts";
import { writeGenerated } from "./impl/writeGenerated.ts";

/**
 * One `<name>.json` form. `$`-keys of a field are notes for the generated source, not data:
 * `$comment` becomes `//` lines above the field, `$off: true` writes the field commented out.
 * `extends: "<name>"` puts that form's fields first, only the `pick`ed ones when given, none `required` when `partial`;
 * `loose`/`strict` (unknown keys kept/rejected) are a Zod matter, read by `generate-meta`.
 */
type FormSource = {
  description?: string;
  extends?: string;
  pick?: string[];
  partial?: boolean;
  fields: Record<string, unknown>[];
};

/** `{ id: "x", name: "y" }` — a flat object literal on one line, keys unquoted where they can be. */
const literal = (entries: Record<string, unknown>) =>
  `{ ${Object.entries(entries)
    .map(([key, value]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(", ")} }`;

const fieldLines = ({ $comment, $off, ...field }: Record<string, unknown>) => [
  ...docLines($comment, { line: true }),
  `${$off ? "// " : ""}${literal(field)},`,
];

/** A form's own fields after the fields of the form it `extends`, and of that form's parent, first. */
const fieldsOf = (name: string, all: Map<string, FormSource>, seen: string[] = []): Record<string, unknown>[] => {
  const form = all.get(name);
  if (!Array.isArray(form?.fields)) throw new Error(`${name}.json: expected { "fields": [...] }`);
  if (seen.includes(name)) throw new Error(`${name}.json: an extends cycle`);
  const inherited = form.extends ? fieldsOf(form.extends, all, [...seen, name]) : [];
  const picked = form.pick ? inherited.filter((field) => form.pick?.includes(field.id as string)) : inherited;
  const parent = form.partial ? picked.map(({ required: _, ...field }) => field) : picked;
  return [...parent, ...form.fields];
};

const formLines = (name: string, form: FormSource, all: Map<string, FormSource>) => {
  const fields = fieldsOf(name, all);
  return [...docLines(form.description), `${name}: [`, ...fields.flatMap(fieldLines).map((line) => `  ${line}`), "],"];
};

/**
 * Generates a forms module: `export const forms = { <name>: [...], … }`, one entry per `<name>.json`
 * in `sourceDir`, each a list of `Forma` field definitions. A form's `description` becomes its doc
 * comment. The module keeps the form typing: it imports `FormField` from `proton/meta`, re-exports
 * it, and checks every form with `satisfies Record<string, FormField[]>`, so a malformed `.json`
 * fails the typecheck.
 *
 * @param sourceDir The folder of `.json` forms, scanned flat.
 * @param outFile Destination module.
 * @param lang The language whose overlay to write (`readJsonFiles`), else the base.
 */
export function generateForms({ sourceDir, outFile, lang }: { sourceDir: string; outFile: string; lang?: string }) {
  const forms = readJsonFiles(sourceDir, lang);
  const all = new Map(forms.map(([name, form]) => [name, form as FormSource]));
  const lines = forms.flatMap(([name, form]) => formLines(name, form as FormSource, all));

  const body = `import type { FormField } from "proton/meta";

export type { FormField };

export const forms = {
${lines.map((line) => `  ${line}`).join("\n")}
} satisfies Record<string, FormField[]>;`;
  writeGenerated({ kind: "forms", sources: [`${sourceDir}/*.json`], outFile, lang, body, count: forms.length });
}
