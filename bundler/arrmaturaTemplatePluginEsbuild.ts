import * as fs from "node:fs";
import type { Plugin } from "esbuild";
import { messageOf } from "./messageOf";
import { parseArrmaturaTemplate } from "./parseArrmaturaTemplate";

/** Loads every `.xml` import as a module whose default export is its pre-parsed component list. */
export const cmlPlugin: Plugin = {
  name: "arrmaturaTemplatePlugin",
  setup(build) {
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

/** Kept beside the named export: emono and arrmatura-books import the plugin as the default. */
export default cmlPlugin;
