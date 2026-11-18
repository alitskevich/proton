import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileJsonContent } from "./readFileJsonContent.ts";

let dir: string;
beforeEach(() => {
  const tempRoot = tmpdir();
  const prefix = join(tempRoot, "utils-files-");
  dir = mkdtempSync(prefix);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("readFileJsonContent", () => {
  it("parses a JSON file", () => {
    const file = join(dir, "x.json");
    writeFileSync(file, '{"a":[1,2]}');
    expect(readFileJsonContent(file)).toEqual({ a: [1, 2] });
  });

  it("gives the default for a missing file: null unless given", () => {
    const missing = join(dir, "missing.json");
    expect(readFileJsonContent(missing)).toBeNull();
    expect(readFileJsonContent(missing, {})).toEqual({});
  });

  it("gives the default for a file that is not JSON", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const file = join(dir, "bad.json");
    writeFileSync(file, "{nope");
    expect(readFileJsonContent(file, [])).toEqual([]);
  });
});
