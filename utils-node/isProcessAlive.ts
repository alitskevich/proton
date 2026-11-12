/**
 * Whether process `pid` runs. Signal 0 only probes: `EPERM` means it runs under another user,
 * any other failure (`ESRCH`, a non-numeric pid) that it does not.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "EPERM";
  }
}
