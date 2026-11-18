import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJsonFiles } from "./readJsonFiles.ts";

let dir: string;
beforeEach(() => {
  const tempRoot = tmpdir();
  const prefix = join(tempRoot, "utils-files-");
  dir = mkdtempSync(prefix);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const write = (file: string, data: unknown) => writeFileSync(join(dir, file), JSON.stringify(data));

describe("readJsonFiles", () => {
  beforeEach(() => {
    write("b.json", {
      items: [
        { id: "w", name: "7 days", "name:nl": "7 dagen" },
        { id: "m", name: "month" },
      ],
    });
    write("a.json", { title: "A" });
    write("notes.txt", "x");
    mkdirSync(join(dir, "sub"));
    write("sub/c.json", { title: "C" });
  });

  it("reads the top-level .json files sorted by name, with translations dropped", () => {
    expect(readJsonFiles(dir)).toEqual([
      ["a", { title: "A" }],
      [
        "b",
        {
          items: [
            { id: "w", name: "7 days" },
            { id: "m", name: "month" },
          ],
        },
      ],
    ]);
  });

  it("gives a language's overlay: only its translations, items matched by id, files with none left out", () => {
    expect(readJsonFiles(dir, "nl")).toEqual([["b", { items: [{ id: "w", name: "7 dagen" }] }]]);
  });

  it("throws, naming the file, for a bad name, bad JSON or no .json files", () => {
    writeFileSync(join(dir, "bad.json"), "{nope");
    expect(() => readJsonFiles(dir)).toThrow(/^bad\.json: /);
    rmSync(join(dir, "bad.json"));
    write("my-file.json", {});
    expect(() => readJsonFiles(dir)).toThrow("my-file.json: not a valid identifier");
    const empty = join(dir, "sub", "empty");
    mkdirSync(empty);
    expect(() => readJsonFiles(empty)).toThrow(`${empty}: no .json files`);
  });
});
