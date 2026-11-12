import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DirEntry, FilesPort } from "./types.ts";

/** `FilesPort` over `node:fs`. */
export function nodeFiles(): FilesPort {
  return {
    async exists(path) {
      try {
        await stat(path);
        return true;
      } catch {
        return false;
      }
    },
    readText: (path) => readFile(path, "utf-8"),
    async writeText(path, text) {
      const parent = dirname(path);
      await mkdir(parent, { recursive: true });
      await writeFile(path, text, "utf-8");
    },
    async list(dir) {
      let entries: Dirent[];
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return [];
      }
      const reads = entries.map(async (entry): Promise<DirEntry> => {
        if (!entry.isSymbolicLink()) return { name: entry.name, isDir: entry.isDirectory() };
        const linkPath = join(dir, entry.name);
        const target = await stat(linkPath).catch(() => null);
        return { name: entry.name, isDir: entry.isDirectory() || target?.isDirectory() === true };
      });
      return Promise.all(reads);
    },
    async size(path) {
      return (await stat(path)).size;
    },
  };
}
