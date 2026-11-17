import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeFileContent } from "./writeFileContent.ts";

let dir: string;
beforeEach(() => {
  const tempRoot = tmpdir();
  const prefix = join(tempRoot, "utils-files-");
  dir = mkdtempSync(prefix);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("writeFileContent", () => {
  it("writes trimmed text with one final newline, creating missing parents", () => {
    const file = join(dir, "a", "x.md");
    writeFileContent(file, "  text\n\n");
    expect(readFileSync(file, "utf8")).toBe("text\n");
  });

  it("awaits a promised text before writing", async () => {
    const file = join(dir, "y.md");
    const text = Promise.resolve("later ");
    await writeFileContent(file, text);
    expect(readFileSync(file, "utf8")).toBe("later\n");
  });

  it("writes nothing for null", () => {
    const file = join(dir, "z.md");
    writeFileContent(file, null);
    expect(existsSync(file)).toBe(false);
  });
});
