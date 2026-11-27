import { readJsonFiles } from "arrmatura-host/files";
import { capitalize } from "ultimus";
import { docLines } from "./impl/docLines.ts";
import { itemsSource } from "./impl/itemsSource.ts";
import { writeGenerated } from "./impl/writeGenerated.ts";

const enumSource = (name: string, data: unknown) => {
  const source = itemsSource(`${name}.json`, data);
  const ids = source.items.map(({ id }) => {
    if (typeof id !== "string") throw new Error(`${name}.json: every item needs a string "id"`);
    return JSON.stringify(id);
  });
  const Name = capitalize(name);
  return [
    ...docLines(source.$comment),
    `export const Z${Name} = z.enum([${ids.join(", ")}]);`,
    "",
    `export type T${Name} = z.infer<typeof Z${Name}>;`,
  ].join("\n");
};

/**
 * Generates a Zod module: per `<name>.json` in `sourceDir`, `export const Z<Name> = z.enum([...ids])` and its
 * `export type T<Name>`, the ids as literals so the type stays exact. The vocabulary's `$comment` is the doc
 * comment. The importing project provides `zod`.
 *
 * @param sourceDir The folder of `.json` vocabularies (`{ items }`), scanned flat.
 * @param outFile Destination module.
 */
export function generateEnums({ sourceDir, outFile }: { sourceDir: string; outFile: string }) {
  const sources = readJsonFiles(sourceDir);
  const body = `import { z } from "zod";

${sources.map(([name, data]) => enumSource(name, data)).join("\n\n")}`;
  writeGenerated({ kind: "enums", sources: [`${sourceDir}/*.json`], outFile, body, count: sources.length });
}
