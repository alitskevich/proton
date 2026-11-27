import * as fs from "node:fs";
import * as path from "node:path";
import type { Plugin } from "esbuild";
import { messageOf } from "./messageOf";
import { parseArrmaturaTemplate } from "./parseArrmaturaTemplate";

/** Vite's convention: an import ending in `?raw` is the file's text, whatever its type. */
const RAW = /\?raw$/;

/**
 * Loads every `.xml` import as a module whose default export is its pre-parsed component list.
 * `file.xml?raw` (any file type) loads the source text instead, so a page can show a template it also renders.
 */
export const cmlPlugin: Plugin = {
  name: "arrmaturaTemplatePlugin",
  setup(build) {
    build.onResolve({ filter: RAW }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(RAW, "")),
      namespace: "raw",
    }));
    build.onLoad({ filter: /.*/, namespace: "raw" }, async (args) => ({
      contents: await fs.promises.readFile(args.path, "utf8"),
      loader: "text",
      watchFiles: [args.path],
    }));

    build.onLoad({ filter: /\.xml$/ }, async (args) => {
      const source = await fs.promises.readFile(args.path, "utf8");

      try {
        const registry = parseArrmaturaTemplate(source);
        const contents = `export default ${JSON.stringify(registry)}`;
        return { contents };
      } catch (error) {
        return { errors: [{ text: messageOf(error) }] };
      }
    });
  },
};
