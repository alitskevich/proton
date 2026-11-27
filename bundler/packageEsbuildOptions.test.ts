import { describe, expect, test } from "bun:test";
import { packageEsbuildOptions } from "./packageEsbuildOptions";

describe("packageEsbuildOptions", () => {
  test("splits servedir off the esbuild block", () => {
    const pkg = { name: "app", esbuild: { servedir: "./site", entryPoints: ["src/main.ts"], format: "cjs" } };
    expect(packageEsbuildOptions(pkg)).toEqual({
      name: "app",
      servedir: "./site",
      options: { entryPoints: ["src/main.ts"], format: "cjs" },
    });
  });

  test("gives empty options for a package without an esbuild block, or no package", () => {
    const empty = { name: undefined, servedir: undefined, options: {} };
    expect(packageEsbuildOptions(null)).toEqual(empty);
    expect(packageEsbuildOptions({ esbuild: [] })).toEqual(empty);
  });

  test("drops a name or servedir that is not a string", () => {
    const pkg = { name: 1, esbuild: { servedir: true } };
    expect(packageEsbuildOptions(pkg)).toEqual({ name: undefined, servedir: undefined, options: {} });
  });
});
