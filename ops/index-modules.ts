import { indexModule } from "./reindex";

/**
 * Regenerates one `registry.ts` per module, cwd-relative.
 *
 *   bun ../proton/ops/index-modules.ts                              a flat package: the root is the module
 *   bun ../proton/ops/index-modules.ts modules/atomic,modules/form  a kit-structured package
 */
const modules = (process.argv[2] ?? ".")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

for (const moduleDir of modules) {
  indexModule({ moduleDir });
}
