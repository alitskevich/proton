import { spawn } from "node:child_process";
import { basename } from "node:path";

/** Runs `cmd` and resolves its stdout; rejects when it cannot start or exits non-zero, with its output. */
export function execText(cmd: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(stdout);
      const output = stderr.trim() || stdout.trim();
      const failure = new Error(`${basename(cmd)} exited ${code}\n${output}`);
      reject(failure);
    });
  });
}
