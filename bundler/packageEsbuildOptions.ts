import type { BuildOptions } from "esbuild";
import { isRecord } from "./isRecord";

export type PackageEsbuild = {
  /** The package's `name`. */
  name?: string;
  /** The dev server's folder: `serve` reads it, esbuild rejects it, so it is kept out of `options`. */
  servedir?: string;
  /**
   * The rest of the `esbuild` block: the WHOLE option set (`format`, `outExtension`, `packages`, …), not only entry
   * points. Passed on unchecked: esbuild validates its own options.
   */
  options: Partial<BuildOptions>;
};

/** Reads the `esbuild` block of a parsed `package.json` of unknown shape, the options of `build` and `serve`. */
export function packageEsbuildOptions(pkg: unknown): PackageEsbuild {
  const { name, esbuild }: Record<string, unknown> = isRecord(pkg) ? pkg : {};
  const { servedir, ...options }: Record<string, unknown> = isRecord(esbuild) ? esbuild : {};
  return {
    name: typeof name === "string" ? name : undefined,
    servedir: typeof servedir === "string" ? servedir : undefined,
    options,
  };
}
