import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execWithTimeout } from "./execWithTimeout.ts";

let dir: string;
beforeEach(() => {
  const tempRoot = tmpdir();
  const prefix = join(tempRoot, "utils-node-");
  dir = mkdtempSync(prefix);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("execWithTimeout", () => {
  it("feeds stdin, runs in cwd and reports code and output", async () => {
    const script = 'process.stdin.on("data", (d) => console.log(String(d) + process.cwd())); process.exitCode = 4';
    const result = await execWithTimeout(process.execPath, ["-e", script], "in:", dir, 5);
    expect(result).toEqual({ code: 4, stdout: `in:${realpathSync(dir)}\n`, stderr: "", timedOut: false });
  });

  it("kills a command that runs past the timeout", async () => {
    const result = await execWithTimeout(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], "", dir, 0.2);
    expect(result.timedOut).toBe(true);
    expect(result.code).toBeNull();
  });

  it("reports a command that cannot start in stderr, never rejecting", async () => {
    const result = await execWithTimeout("definitely-not-a-command-xyz", [], "", dir, 5);
    expect(result.stderr).toMatch(/ENOENT|not found/);
    expect(result.timedOut).toBe(false);
  });
});
