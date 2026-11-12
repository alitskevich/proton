/// <reference types="node" />
// Writes a content repo's www/sitemap.xml: one <url> per page the book site shows. Run in the
// content repo, as its `npm run build:sitemap`:
//
//   bun ../proton/ops/sitemap.ts <siteUrl> [dir]
//
// It reads the same files `index-docs.ts` writes to www/index.json (default `dir` = `docs`). A
// page's url is its path under `dir`, as arrmatura-books routes it: `dir/a/b.md` -> `/a/b.md`,
// `dir/index.md` -> `/`. Only markdown the tree shows is listed: nothing under a `_` or `.`
// segment, no CLAUDE.md or INDEX.md. `<lastmod>` is the file's last commit date; an untracked
// file has none.

import { execFileSync } from "node:child_process";
import { listFiles } from "./index-docs";
import { writeFileContent } from "./utils/files";

const HIDDEN = new Set(["CLAUDE.md", "INDEX.md"]);

const isPage = (path: string) =>
  path.endsWith(".md") && !path.split("/").some((part) => HIDDEN.has(part) || part[0] === "_" || part[0] === ".");

/** Each file's last commit date (`YYYY-MM-DD`): `git log` lists the newest commit first. */
function lastCommitDates(dir: string): Map<string, string> {
  const args = ["-c", "core.quotePath=false", "log", "--format=@%cs", "--name-only", "--", dir];
  const dates = new Map<string, string>();
  let date = "";
  for (const line of execFileSync("git", args, { encoding: "utf8" }).split("\n")) {
    if (line.startsWith("@")) date = line.slice(1);
    else if (line && !dates.has(line)) dates.set(line, date);
  }
  return dates;
}

const escapeXml = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function main() {
  const [siteUrl, dir = "docs"] = process.argv.slice(2);
  if (!siteUrl) throw new Error("Usage: bun ../proton/ops/sitemap.ts <siteUrl> [dir]");
  const base = siteUrl.replace(/\/+$/, "");
  const dates = lastCommitDates(dir);

  const urls = listFiles(dir)
    .filter(isPage)
    .sort()
    .map((path) => {
      const doc = path.slice(dir.length + 1);
      const route = doc === "index.md" ? "" : doc;
      const loc = `<loc>${escapeXml(`${base}/${encodeURI(route)}`)}</loc>`;
      const date = dates.get(path);
      return `  <url>${loc}${date ? `<lastmod>${date}</lastmod>` : ""}</url>`;
    });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");

  writeFileContent("www/sitemap.xml", xml);
  console.log(`✅ Mapped ${urls.length} pages of ${dir}/ -> www/sitemap.xml`);
}

main();
