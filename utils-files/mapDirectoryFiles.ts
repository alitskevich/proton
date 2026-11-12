import { type Dirent, existsSync, readdirSync, statSync } from "node:fs";

/**
 * Applies `fn` to every file under `rootDir`, sorted by name, and returns the non-null results.
 * `fn` gets the entry, its directory relative to `rootDir` (`""` at the top) and `rootDir`.
 * A missing or non-directory `rootDir` gives `[]`.
 */
export const mapDirectoryFiles = <T>(
  rootDir: string,
  fn: (entry: Dirent, dir: string, rootDir: string) => T | null,
  { recursive = true }: { recursive?: boolean } = {},
): Array<T> => {
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) return [];

  return readdirSync(rootDir, { withFileTypes: true, recursive })
    .filter((entry: Dirent) => !entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const dir = entry.parentPath === rootDir ? "" : entry.parentPath.slice(rootDir.length + 1);
      return fn(entry, dir, rootDir);
    })
    .filter((result) => result != null);
};
