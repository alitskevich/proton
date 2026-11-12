import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mapDirectoryFiles } from "./mapDirectoryFiles.ts";

let dir: string;
beforeEach(() => {
  const tempRoot = tmpdir();
  const prefix = join(tempRoot, "utils-files-");
  dir = mkdtempSync(prefix);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("mapDirectoryFiles", () => {
  beforeEach(() => {
    const deepDir = join(dir, "sub", "deep");
    mkdirSync(deepDir, { recursive: true });
    for (const file of ["b.txt", "a.txt", "sub/c.txt", "sub/deep/d.txt"]) {
      const path = join(dir, file);
      writeFileSync(path, "");
    }
  });

  it("maps every file under the root, by name, with its directory relative to the root", () => {
    const seen = mapDirectoryFiles(dir, (entry, relativeDir, root) => {
      expect(root).toBe(dir);
      return `${relativeDir}|${entry.name}`;
    });
    expect(seen).toEqual(["|a.txt", "|b.txt", "sub|c.txt", "sub/deep|d.txt"]);
  });

  it("keeps to the top level when not recursive and drops null results", () => {
    const seen = mapDirectoryFiles(dir, (entry) => (entry.name === "b.txt" ? null : entry.name), { recursive: false });
    expect(seen).toEqual(["a.txt"]);
  });

  it("gives [] for a missing directory or a file", () => {
    const missing = join(dir, "missing");
    const file = join(dir, "a.txt");
    expect(mapDirectoryFiles(missing, (entry) => entry.name)).toEqual([]);
    expect(mapDirectoryFiles(file, (entry) => entry.name)).toEqual([]);
  });
});
