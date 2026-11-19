import { describe, expect, test } from "bun:test";
import { cmlPlugin } from "./arrmaturaTemplatePluginEsbuild";
import { getEsbuildOptions } from "./getEsbuildOptions";

describe("getEsbuildOptions", () => {
  test("defaults to a minified browser ESM bundle of src/index.ts with an external sourcemap", () => {
    expect(getEsbuildOptions()).toMatchObject({
      entryPoints: ["src/index.ts"],
      outdir: "./www/dist",
      bundle: true,
      platform: "browser",
      format: "esm",
      sourcemap: "external",
      minify: true,
      plugins: [cmlPlugin],
      loader: { ".xml": "text", ".md": "text", ".png": "file", ".svg": "file" },
    });
  });

  test("lets given options win, merging loaders", () => {
    const options = getEsbuildOptions({ outdir: "dist", minify: false, loader: { ".xml": "file", ".txt": "text" } });
    expect(options).toMatchObject({ outdir: "dist", minify: false });
    expect(options.loader).toEqual({ ".xml": "file", ".md": "text", ".png": "file", ".svg": "file", ".txt": "text" });
  });
});
