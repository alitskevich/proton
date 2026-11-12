import { afterEach, describe, expect, test, vi } from "vitest";
import { arrmaturaTemplatePlugin } from "./arrmaturaTemplatePluginVite";

describe("arrmaturaTemplatePlugin (Vite)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("ignores a module that is not .xml", () => {
    expect(arrmaturaTemplatePlugin().transform("x", "a.ts")).toBeUndefined();
  });

  test("a template that fails to parse exports one closed error paragraph", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = arrmaturaTemplatePlugin().transform(
      `<Component id="Broken"><a><b></a></b></Component>`,
      "Broken.xml",
    );
    const html: unknown = JSON.parse(result?.code.replace("export default ", "") ?? "null");

    expect(html).toMatch(/^<p style="color:red;">.* in Broken\.xml<\/p>$/);
  });
});
