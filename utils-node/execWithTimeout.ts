import { spawn } from "node:child_process";
import type { ExecResult } from "./types.ts";

const MS_PER_SECOND = 1_000;

/** Runs `cmd` in `cwd` with `input` on stdin, killing it after `timeoutSeconds`. Never rejects. */
export function execWithTimeout(
  cmd: string,
  args: string[],
  input: string,
  cwd: string,
  timeoutSeconds: number,
): Promise<ExecResult> {
  return new Promise((done) => {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeoutMs = timeoutSeconds * MS_PER_SECOND;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => (stderr += String(error)));
    child.on("close", (code) => {
      clearTimeout(timer);
      done({ code, stdout, stderr, timedOut });
    });
    child.stdin.end(input);
  });
}
