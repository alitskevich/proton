/**
 * This machine, as dev tools see it: a dev tool runs, and its server answers, on a local host only.
 * Pure, so a dev server imports it as freely as the browser bundle does.
 */

export const LOCAL_HOSTNAMES: string[] = ["localhost", "127.0.0.1", "[::1]"];

/** True for a hostname of this machine. */
export const isLocalHost = (hostname: string) => LOCAL_HOSTNAMES.includes(hostname);

/** True for an `Origin` header whose host is this machine; a malformed origin is not local. */
export function isLocalOrigin(origin: string): boolean {
  try {
    return isLocalHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}
