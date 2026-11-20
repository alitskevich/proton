import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";

/** The machine's secrets file, shared by every project. */
const KEYS_FILE = join(homedir(), ".keys", ".env");

/**
 * `env` with the variables of `file` laid over it: the file wins, `env` is the fallback. Parsed as dotenv, not
 * sourced by a shell, so an unquoted JSON value keeps its quotes; a name set twice keeps its last line.
 */
export function readKeysEnv(file = KEYS_FILE, env = process.env): Record<string, string | undefined> {
  const keys = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
  return { ...env, ...keys };
}
