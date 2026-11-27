/** Every type of `utils-node`. Node's own types are re-exported from here, so nothing else imports them. */

export type { IncomingMessage, ServerResponse } from "node:http";

/** The types of `Processes`, owned by `arrmatura-host/processes`. */
export type { IProcess, SpawnSpec } from "arrmatura-host/processes";

export type ProbePort = {
  isListening(port: number, timeoutMs: number): Promise<boolean>;
};

/** How a command run by `execWithTimeout` ended; `code` is `null` when a signal stopped it. */
export type ExecResult = { code: number | null; stdout: string; stderr: string; timedOut: boolean };

/** What `loginGoogle` signs in with: a Desktop-app OAuth client, the scope it asks for, who signs in. */
export type GoogleLogin = {
  clientId: string;
  clientSecret: string;
  /** Space-separated. */
  scope: string;
  /** Named in the prompt: "Sign in with <account>". */
  account: string;
  /** Opens the consent page; default the macOS `open`. */
  open?: (url: string) => void;
  fetch?: typeof fetch;
};

/** A Desktop-app OAuth client and the refresh token a login obtained. */
export type GoogleCredentials = { clientId: string; clientSecret: string; refreshToken: string };
