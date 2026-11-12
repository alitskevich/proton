import { type SpawnOptions, spawn } from "node:child_process";
import type { ProcessHandle, ProcessPort, SpawnSpec } from "./types.ts";

/** The shell's "command not found" exit code, reported when a child cannot start. */
const SPAWN_FAILED_CODE = 127;

/** `ProcessPort` over `node:child_process`: every child leads its own process group, so `kill` stops its whole tree. */
export function nodeProcesses(): ProcessPort {
  return {
    spawn({ argv, shell, cwd, env }: SpawnSpec): ProcessHandle {
      const options: SpawnOptions = {
        cwd,
        env,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      };
      const [command, ...args] = argv ?? [];
      const child = argv ? spawn(command, args, options) : spawn(shell as string, { ...options, shell: true });
      const dataListeners: Array<(stream: "stdout" | "stderr", chunk: string) => void> = [];
      const exitListeners: Array<(code: number | null) => void> = [];
      let exited = false;
      const finish = (code: number | null) => {
        if (exited) return;
        exited = true;
        for (const listener of exitListeners) listener(code);
      };
      child.stdout?.setEncoding("utf-8");
      child.stderr?.setEncoding("utf-8");
      child.stdout?.on("data", (chunk: string) => {
        for (const listener of dataListeners) listener("stdout", chunk);
      });
      child.stderr?.on("data", (chunk: string) => {
        for (const listener of dataListeners) listener("stderr", chunk);
      });
      child.on("error", (error) => {
        for (const listener of dataListeners) listener("stderr", `${error.message}\n`);
        finish(SPAWN_FAILED_CODE);
      });
      child.on("close", (code) => finish(code));
      return {
        pid: child.pid ?? 0,
        onData: (listener) => {
          dataListeners.push(listener);
        },
        onExit: (listener) => {
          exitListeners.push(listener);
        },
        kill: () => {
          try {
            if (child.pid !== undefined) process.kill(-child.pid, "SIGTERM");
          } catch {
            child.kill("SIGTERM");
          }
        },
      };
    },
  };
}
