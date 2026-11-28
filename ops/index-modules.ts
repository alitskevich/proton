import { parseArgs } from "node:util";
import { stringSplit } from "ultimus";
import { indexModule } from "./reindex.ts";

/**
 * Regenerates one `registry.ts` per module, cwd-relative.
 *
 *   arrmatura-support index-modules                              a flat package: the root is the module
 *   arrmatura-support index-modules modules/atomic,modules/form  a kit-structured package
 */
const { positionals } = parseArgs({ allowPositionals: true });
const modules = stringSplit(positionals[0] ?? ".");

for (const moduleDir of modules) {
  indexModule({ moduleDir });
}
