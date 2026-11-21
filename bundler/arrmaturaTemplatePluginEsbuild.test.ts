import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { build } from "esbuild";
import { cmlPlugin } from "./arrmaturaTemplatePluginEsbuild";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cml-plugin-"));
const TEMPLATE = `<Component id="Hello"><p>Hi</p></Component>`;
fs.writeFileSync(path.join(dir, "Hello.xml"), TEMPLATE);

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Bundles `entry` with the plugin and returns the bundle's code. */
async function bundle(entry: string): Promise<string> {
  const result = await build({
    stdin: { contents: entry, resolveDir: dir, loader: "ts" },
    bundle: true,
    write: false,
    format: "esm",
    plugins: [cmlPlugin],
  });
  return result.outputFiles[0]?.text ?? "";
}

describe("cmlPlugin (esbuild)", () => {
  test("a .xml import is the parsed component list", async () => {
    const code = await bundle(`import t from "./Hello.xml"; export default t;`);
    expect(code).toContain(`[{ "tag": "Hello", "template": [{ "tag": "p", "id": "X1", "text": "Hi" }] }]`);
  });

  test("a .xml?raw import is the source text, beside the parsed import of the same file", async () => {
    const code = await bundle(
      `import t from "./Hello.xml"; import raw from "./Hello.xml?raw"; export default [t, raw];`,
    );
    expect(code).toContain(`"tag": "Hello"`);
    expect(code).toContain(TEMPLATE);
  });
});
