import { messageOf } from "./messageOf";
import { parseArrmaturaTemplate } from "./parseArrmaturaTemplate";

/**
 * Vite plugin: turns every `.xml` import into a module whose default export is its pre-parsed
 * component list. A file that fails to parse exports an HTML error message instead.
 */
export function arrmaturaTemplatePlugin() {
  return {
    name: "arrmatura-template-xml",
    transform(source: string, id: string) {
      if (!id.endsWith(".xml")) return;
      let code = "";
      try {
        const registry = parseArrmaturaTemplate(source);
        code = `export default ${JSON.stringify(registry)}`;
      } catch (error) {
        console.log(error);
        const errorHtml = `<p style="color:red;">${messageOf(error)} in ${id}</p>`;
        code = `export default ${JSON.stringify(errorHtml)}`;
      }
      return {
        code,
        map: null, // provide source map if available
      };
    },
  };
}
