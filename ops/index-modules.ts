import { indexModule } from "./reindex";

/**
 * Regenerates one `registry.ts` per module, cwd-relative.
 *
 *   proton index-modules                              a flat package: the root is the module
 *   proton index-modules modules/atomic,modules/form  a kit-structured package
 */
const modules = (process.argv[2] ?? ".")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

for (const moduleDir of modules) {
  indexModule({ moduleDir });
}
