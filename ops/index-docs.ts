/// <reference types="node" />
// Writes a content repo's site index, www/index.json, so the site reads its tree from its own
// host instead of jsDelivr. Run in the content repo, as its `npm run build:index`:
//
//   bun ../proton/ops/index-docs.ts [dir] [--watch]
//
// The index lists the files under `dir` (default `docs`) that git does not ignore, tracked or
// not, in the shape of a jsDelivr `?structure=tree` listing, so arrmatura-books'
// `BookIndexTreeService` reads it as-is with `scope` = `dir`. `--watch` re-indexes whenever a
// file under `dir` is added, removed or renamed.

import { execFileSync } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { writeFileContent } from "./utils/files";

/** One node of a jsDelivr `?structure=tree` listing: a directory carries its children. */
interface TreeEntry {
  type: "file" | "directory";
  name: string;
  files?: TreeEntry[];
}

type Tree = Pick<TreeEntry, "files">;

/** Folds `a/b/c.md` paths into nested directory entries. */
function treeOf(paths: string[]): Tree {
  const root: Tree = { files: [] };
  for (const path of paths) {
    const segments = path.split("/");
    const name = segments.pop() as string;
    let dir = root;
    for (const segment of segments) {
      let next = dir.files?.find((entry) => entry.type === "directory" && entry.name === segment);
      if (!next) {
        next = { type: "directory", name: segment, files: [] };
        dir.files?.push(next);
      }
      dir = next;
    }
    dir.files?.push({ type: "file", name });
  }
  return root;
}

/** The files under `dir` as they stand in the working tree, minus what git ignores. */
function listFiles(dir: string): string[] {
  const args = ["ls-files", "--cached", "--others", "--exclude-standard", "--", dir];
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .filter((path) => path && existsSync(path));
}

function main() {
  const args = process.argv.slice(2);
  const dir = args.find((arg) => !arg.startsWith("--")) ?? "docs";
  const indexFile = "www/index.json";
  let last = "";

  const index = () => {
    const paths = listFiles(dir);
    const content = JSON.stringify(treeOf(paths));
    if (content === last) return;
    last = content;
    writeFileContent(indexFile, content);
    console.log(`✅ Indexed ${paths.length} files of ${dir}/ -> ${indexFile}`);
  };

  index();

  if (args.includes("--watch")) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    watch(dir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(index, 100);
    });
    console.log(`Watching ${dir}/ for added, removed or renamed files`);
  }
}

main();
