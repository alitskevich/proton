import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const MODULE = join(import.meta.dirname, "runCommand.ts");

/** Runs `runCommand(bin, args)` in a fresh Node process, as a script would, and gives how that process ended. */
const runScript = (bin: string, args: string[]) => {
  const code = `import { runCommand } from ${JSON.stringify(MODULE)}; runCommand(${JSON.stringify(bin)}, ${JSON.stringify(args)});`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
};

describe("runCommand", () => {
  it("passes the child's output and exit code through", () => {
    const result = runScript(process.execPath, ["-e", "console.log('hi'); process.exit(3)"]);
    expect(result.stdout).toBe("hi\n");
    expect(result.status).toBe(3);
  });

  it("exits 1 with a message when the command cannot start", () => {
    const result = runScript("no-such-command-xyz", []);
    expect(result.stderr).toContain("❌ no-such-command-xyz:");
    expect(result.status).toBe(1);
  });
});
