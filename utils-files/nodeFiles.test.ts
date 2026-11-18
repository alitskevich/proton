import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nodeFiles } from "./nodeFiles.ts";

let dir: string;
beforeEach(() => {
  const tempRoot = tmpdir();
  const prefix = join(tempRoot, "utils-files-");
  dir = mkdtempSync(prefix);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("nodeFiles", () => {
  it("writes with missing parents, reads, sizes in bytes and checks existence", async () => {
    const files = nodeFiles();
    const file = join(dir, "a", "b", "x.md");
    expect(await files.exists(file)).toBe(false);
    await files.writeText(file, "é");
    expect(await files.exists(file)).toBe(true);
    expect(await files.readText(file)).toBe("é");
    expect(await files.size(file)).toBe(2);
  });

  it("rejects reading an absent file", async () => {
    const missing = join(dir, "missing");
    await expect(nodeFiles().readText(missing)).rejects.toThrow();
  });

  it("lists children with directories (symlinked ones too) and returns [] for a missing dir", async () => {
    const files = nodeFiles();
    const real = join(dir, "real");
    const file = join(dir, "f.txt");
    const link = join(dir, "link");
    const gone = join(dir, "gone");
    const dangling = join(dir, "dangling");
    mkdirSync(real);
    writeFileSync(file, "x");
    symlinkSync(real, link);
    symlinkSync(gone, dangling);
    const entries = (await files.list(dir)).sort((a, b) => a.name.localeCompare(b.name));
    expect(entries).toEqual([
      { name: "dangling", isDir: false },
      { name: "f.txt", isDir: false },
      { name: "link", isDir: true },
      { name: "real", isDir: true },
    ]);
    const missing = join(dir, "missing");
    expect(await files.list(missing)).toEqual([]);
  });
});
