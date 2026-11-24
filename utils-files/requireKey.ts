import { readKeysEnv } from "./readKeysEnv.ts";

/** The value of `name` in `env` (`~/.keys/.env` over the process env); when it is missing, the error says to take it from `source`. */
export function requireKey(name: string, source: string, env = readKeysEnv()): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not in ~/.keys/.env or the env; take it from ${source}`);
  return value;
}
