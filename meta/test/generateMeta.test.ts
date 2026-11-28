import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateMeta } from "../generateMeta.ts";

let root = "";
const metaDir = () => join(root, ".meta");
const outDir = () => join(root, "out");
const put = (path: string, data: unknown) => {
  const file = join(metaDir(), path);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
};
const read = (name: string) => readFileSync(join(outDir(), name), "utf8");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  root = mkdtempSync(join(tmpdir(), "generate-meta-"));
  put("enums/gender.json", { items: [{ id: "male", name: "male", "name:nl": "man" }] });
  put("forms/contacts.json", { fields: [{ id: "name", name: "Name", "name:nl": "Naam" }] });
  put("strings/app.json", { title: "Alex", "title:nl": "Alex NL" });
  put("structs/byGender.json", { fields: [{ id: "gender", type: "enum", typeSpec: "gender", required: true }] });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("generateMeta", () => {
  it("writes one module per source, the Zod ones too", () => {
    generateMeta({ metaDir: metaDir(), outDir: outDir() });
    expect(readdirSync(outDir()).sort()).toEqual(["forms.ts", "schema.ts", "shapes.ts", "strings.ts", "structs.ts"]);
    expect(read("forms.ts")).toContain('import type { FormField } from "arrmatura-support/meta";');
    expect(read("schema.ts")).toContain('export const ZGender = z.enum(["male"]);');
    expect(read("structs.ts")).toContain("gender: ZGender,");
  });

  it("skips the Zod modules without zod", () => {
    generateMeta({ metaDir: metaDir(), outDir: outDir(), zod: false });
    expect(readdirSync(outDir()).sort()).toEqual(["forms.ts", "shapes.ts", "strings.ts"]);
  });

  it("writes a language's overlay of the translatable modules alone", () => {
    generateMeta({ metaDir: metaDir(), outDir: outDir(), lang: "nl" });
    expect(readdirSync(outDir()).sort()).toEqual(["nl.forms.ts", "nl.shapes.ts", "nl.strings.ts"]);
    expect(read("nl.forms.ts")).toContain('{ id: "name", name: "Naam" }');
  });

  it("skips a missing source", () => {
    rmSync(join(metaDir(), "forms"), { recursive: true });
    generateMeta({ metaDir: metaDir(), outDir: outDir() });
    expect(existsSync(join(outDir(), "forms.ts"))).toBe(false);
  });

  it("refuses a form among the structs", () => {
    put("structs/contacts.json", { fields: [{ id: "name", name: "Name" }] });
    expect(() => generateMeta({ metaDir: metaDir(), outDir: outDir() })).toThrow("move it to .meta/forms");
  });

  it("writes a pattern's slash after an escaped backslash so the module parses", () => {
    put("structs/path.json", { fields: [{ id: "path", pattern: "a\\\\/b" }] });
    generateMeta({ metaDir: metaDir(), outDir: outDir() });
    const structs = read("structs.ts");
    expect(structs).toContain("path: z.string().regex(/a\\\\\\/b/).optional(),");
    expect(() => new Bun.Transpiler({ loader: "ts" }).transformSync(structs)).not.toThrow();
  });

  it("takes required: false as an optional field", () => {
    put("structs/note.json", { fields: [{ id: "text", required: false }] });
    generateMeta({ metaDir: metaDir(), outDir: outDir() });
    expect(read("structs.ts")).toContain("text: z.string().optional(),");
  });

  it("names a struct without fields", () => {
    put("structs/empty.json", { description: "no fields" });
    expect(() => generateMeta({ metaDir: metaDir(), outDir: outDir() })).toThrow(
      'empty.json: expected { "fields": [...] }',
    );
  });

  it("names a primitives file that is not { items }", () => {
    put("primitives.json", [{ id: "code" }]);
    expect(() => generateMeta({ metaDir: metaDir(), outDir: outDir() })).toThrow(
      'primitives.json: expected { "items": [...] }',
    );
  });

  it("names a functions file whose item has no module", () => {
    put("functions.json", { items: [{ id: "slug" }] });
    expect(() => generateMeta({ metaDir: metaDir(), outDir: outDir() })).toThrow(
      'functions.json: every item needs a string "id" and a string "from"',
    );
  });
});
