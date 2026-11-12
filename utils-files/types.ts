/** Every type of `utils-files`. Node's own types are re-exported from here, so nothing else imports them. */

export type { Dirent } from "node:fs";

export type DirEntry = { name: string; isDir: boolean };

export type FilesPort = {
  exists(path: string): Promise<boolean>;
  /** Rejects when the file is absent. */
  readText(path: string): Promise<string>;
  /** Creates missing parent directories. */
  writeText(path: string, text: string): Promise<void>;
  /** Direct children; `[]` when `dir` is absent. */
  list(dir: string): Promise<DirEntry[]>;
  /** Size in bytes. */
  size(path: string): Promise<number>;
};
