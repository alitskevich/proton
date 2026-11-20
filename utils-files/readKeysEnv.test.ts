import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readKeysEnv } from "./readKeysEnv.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "utils-files-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("readKeysEnv", () => {
  it("lays the file over the env: the file wins, the env is the fallback", () => {
    const file = join(dir, ".env");
    writeFileSync(file, "A=file\n");
    expect(readKeysEnv(file, { A: "env", B: "env" })).toEqual({ A: "file", B: "env" });
  });

  it("keeps an unquoted JSON value whole and the last line of a name set twice", () => {
    const file = join(dir, ".env");
    writeFileSync(file, 'J={"a":"b"}\nT=old\nT=\'new\'\n');
    expect(readKeysEnv(file, {})).toEqual({ J: '{"a":"b"}', T: "new" });
  });

  it("is the env alone when the file is missing", () => {
    expect(readKeysEnv(join(dir, "missing"), { A: "env" })).toEqual({ A: "env" });
  });
});
