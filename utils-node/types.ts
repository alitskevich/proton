/** Every type of `utils-node`. Node's own types are re-exported from here, so nothing else imports them. */

export type { IncomingMessage, ServerResponse } from "node:http";

/** Exactly one of `argv` (no shell) or `shell` (run through the shell) is set. */
export type SpawnSpec = {
  argv?: string[];
  shell?: string;
  cwd: string;
  env: Record<string, string | undefined>;
};

export type ProcessHandle = {
  pid: number;
  onData(listener: (stream: "stdout" | "stderr", chunk: string) => void): void;
  /** `null` when the process was killed by a signal. */
  onExit(listener: (code: number | null) => void): void;
  /** SIGTERM to the whole process group. */
  kill(): void;
};

export type ProcessPort = {
  spawn(spec: SpawnSpec): ProcessHandle;
};

export type ProbePort = {
  isListening(port: number, timeoutMs: number): Promise<boolean>;
};

/** How a command run by `execWithTimeout` ended; `code` is `null` when a signal stopped it. */
export type ExecResult = { code: number | null; stdout: string; stderr: string; timedOut: boolean };
