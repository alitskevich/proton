import { spawn } from "node:child_process";

const FORWARDED = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

/**
 * Runs `bin` in place of the current process: same stdio, same exit code. A signal sent to this
 * process alone (a test runner or task manager stopping its server) is passed on, so the child
 * never outlives it; Ctrl+C in a terminal already reaches the whole group.
 */
export function runCommand(bin: string, args: string[]) {
  const child = spawn(bin, args, { stdio: "inherit" });
  for (const signal of FORWARDED) process.on(signal, () => child.kill(signal));
  child.on("error", (err) => {
    console.error(`❌ ${bin}: ${err.message}`);
    process.exit(1);
  });
  child.on("exit", (code) => process.exit(code ?? 1));
}
