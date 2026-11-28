import { readJsonFiles } from "arrmatura-host/files";
import { isRecord, jsonSource } from "ultimus";
import { writeGenerated } from "./impl/writeGenerated.ts";

/**
 * Generates a strings module: one `export const <name> = { … }` per `<name>.json` in `sourceDir`,
 * each a UI-strings area (an object of texts, nested groups allowed). A `.json` holds literal text
 * only, so a value computed elsewhere is written into it as text. `$`-keys are notes, not data — see
 * `jsonSource`.
 *
 * @param sourceDir The folder of `.json` string areas, scanned flat.
 * @param outFile Destination module.
 * @param lang The language whose overlay to write (`readJsonFiles`), else the base.
 */
export function generateStrings({ sourceDir, outFile, lang }: { sourceDir: string; outFile: string; lang?: string }) {
  const areas = readJsonFiles(sourceDir, lang);
  for (const [name, area] of areas) {
    if (!isRecord(area)) throw new Error(`${name}.json: expected an object`);
  }
  const body = areas.map(([name, area]) => `export const ${name} = ${jsonSource(area as never)};`).join("\n\n");
  writeGenerated({ kind: "strings", sources: [`${sourceDir}/*.json`], outFile, lang, body, count: areas.length });
}
