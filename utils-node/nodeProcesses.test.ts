import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nodeProcesses } from "./nodeProcesses.ts";

let dir: string;
beforeEach(() => {
  const tempRoot = tmpdir();
  const prefix = join(tempRoot, "utils-node-");
  dir = mkdtempSync(prefix);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("nodeProcesses", () => {
  const run = (script: string) => {
    const env = { ...process.env };
    return nodeProcesses().spawn({ argv: [process.execPath, "-e", script], cwd: dir, env });
  };

  it("streams output and reports the exit code", async () => {
    const handle = run('console.log("out"); console.error("err"); process.exit(3)');
    let seen = "";
    handle.onData((stream, chunk) => {
      seen += `${stream}:${chunk}`;
    });
    const code = await new Promise<number | null>((resolve) => handle.onExit(resolve));
    expect(code).toBe(3);
    expect(seen).toContain("stdout:out");
    expect(seen).toContain("stderr:err");
  });

  it("kills the process group, reporting a null code", async () => {
    const handle = run("setTimeout(() => {}, 60000)");
    const exited = new Promise<number | null>((resolve) => handle.onExit(resolve));
    handle.kill();
    expect(await exited).toBeNull();
  });

  it("runs a shell command in the given cwd", async () => {
    const env = { ...process.env };
    const handle = nodeProcesses().spawn({ shell: "pwd", cwd: dir, env });
    let seen = "";
    handle.onData((_stream, chunk) => {
      seen += chunk;
    });
    await new Promise<number | null>((resolve) => handle.onExit(resolve));
    const dirName = dir.split("/").pop() as string;
    expect(seen.trim().endsWith(dirName)).toBe(true);
  });

  it("reports a command that cannot start as a failed run, not a hang", async () => {
    const env = { ...process.env };
    const handle = nodeProcesses().spawn({ argv: ["definitely-not-a-command-xyz"], cwd: dir, env });
    const code = await new Promise<number | null>((resolve) => handle.onExit(resolve));
    expect(code).not.toBe(0);
  });
});
