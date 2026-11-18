import { describe, expect, it } from "bun:test";
import { basename } from "node:path";
import { execText } from "./execText.ts";

describe("execText", () => {
  it("resolves the stdout of a command that exits 0", async () => {
    expect(await execText(process.execPath, ["-e", 'process.stdout.write("out")'])).toBe("out");
  });

  it("rejects a non-zero exit with the command name, the code and stderr", async () => {
    await expect(execText(process.execPath, ["-e", 'console.error("boom"); process.exit(2)'])).rejects.toThrow(
      `${basename(process.execPath)} exited 2\nboom`,
    );
  });

  it("falls back to stdout when stderr is empty", async () => {
    await expect(execText(process.execPath, ["-e", 'console.log("why"); process.exit(1)'])).rejects.toThrow(
      /exited 1\nwhy$/,
    );
  });

  it("rejects a command that cannot start", async () => {
    await expect(execText("definitely-not-a-command-xyz", [])).rejects.toThrow(/ENOENT|not found/);
  });
});
