import { existsSync } from "node:fs";
import { posix } from "node:path";
import { generateEnums } from "./enums.ts";
import { generateForms } from "./forms.ts";
import { generateShapes } from "./shapes.ts";
import { generateStrings } from "./strings.ts";
import { generateStructs } from "./structs.ts";

/**
 * Generates the code of a project's model from `metaDir` into `outDir`, one module per source that exists:
 *
 * | Source | Module |
 * | --- | --- |
 * | `enums/` | `shapes.ts` (`<name>Shape` rows), and with `zod` `schema.ts` (`Z<Name>` / `T<Name>`) |
 * | `forms/` | `forms.ts` (`forms.<name>`, typed by `FormField` of `arrmatura-support/meta`) |
 * | `strings/` | `strings.ts` (one `export const <area>` per file) |
 * | `structs/`, `primitives.json`, `functions.json` | with `zod`, `structs.ts` (`Z<Name>` / `T<Name>`) |
 *
 * With `lang`, it writes that language's overlay of the translatable ones (shapes, forms, strings) as
 * `<lang>.<module>.ts` instead.
 */
export function generateMeta({
  metaDir,
  outDir,
  zod = true,
  lang,
}: {
  metaDir: string;
  outDir: string;
  zod?: boolean;
  lang?: string;
}) {
  const source = (name: string) => posix.join(metaDir, name);
  const has = (name: string) => existsSync(source(name));
  const outFile = (name: string) => posix.join(outDir, lang ? `${lang}.${name}.ts` : `${name}.ts`);

  if (has("enums")) generateShapes({ sourceDir: source("enums"), outFile: outFile("shapes"), lang });
  if (has("forms")) generateForms({ sourceDir: source("forms"), outFile: outFile("forms"), lang });
  if (has("strings")) generateStrings({ sourceDir: source("strings"), outFile: outFile("strings"), lang });
  if (lang || !zod) return;
  if (has("enums")) generateEnums({ sourceDir: source("enums"), outFile: outFile("schema") });
  if (has("structs"))
    generateStructs({
      sourceDir: source("structs"),
      primitivesFile: source("primitives.json"),
      functionsFile: source("functions.json"),
      outFile: outFile("structs"),
    });
}
