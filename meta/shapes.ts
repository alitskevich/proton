import { readJsonFiles } from "arrmatura-host/files";
import { jsonSource } from "ultimus";
import { docLines } from "./impl/docLines.ts";
import { itemsSource } from "./impl/itemsSource.ts";
import { writeGenerated } from "./impl/writeGenerated.ts";

const shapeSource = (name: string, data: unknown) => {
  const shape = itemsSource(`${name}.json`, data);
  return [
    ...docLines(shape.$comment, { line: true }),
    `export const ${name}Shape = ${jsonSource(shape.items as never)} as const;`,
  ].join("\n");
};

/**
 * Generates a shapes module: one `export const <name>Shape = [...] as const` per `<name>.json` in
 * `sourceDir`. The `as const` is the point — a `.json` import types its values as plain `string`,
 * while the generated literal keeps every id a literal type, so a `z.enum` built from it stays exact.
 * `$`-keys are notes, not data — see `jsonSource`.
 *
 * @param sourceDir The folder of `.json` vocabularies (`{ items }`), scanned flat.
 * @param outFile Destination module.
 * @param lang The language whose overlay to write (`readJsonFiles`), else the base.
 */
export function generateShapes({ sourceDir, outFile, lang }: { sourceDir: string; outFile: string; lang?: string }) {
  const shapes = readJsonFiles(sourceDir, lang);
  const body = shapes.map(([name, data]) => shapeSource(name, data)).join("\n\n");
  writeGenerated({ kind: "shapes", sources: [`${sourceDir}/*.json`], outFile, lang, body, count: shapes.length });
}
