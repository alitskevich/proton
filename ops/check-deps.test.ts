import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileContent } from "arrmatura-host/files";

const SCRIPT = `${import.meta.dir}/check-deps.ts`;
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** A package tree in a temp folder: path → content, a package.json given as an object. */
function tree(files: Record<string, string | object>) {
  const dir = mkdtempSync(join(tmpdir(), "arrmatura-support-check-deps-"));
  dirs.push(dir);
  for (const [path, content] of Object.entries(files)) {
    writeFileContent(join(dir, path), typeof content === "string" ? content : JSON.stringify(content));
  }
  return dir;
}

/** Runs the script as `arrmatura-support check-deps` does, in `cwd`. */
async function checkDeps(cwd: string) {
  const child = Bun.spawn([process.execPath, SCRIPT], { cwd, stdout: "pipe", stderr: "pipe" });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  return { code, stderr };
}

describe("check-deps", () => {
  test("fails on a library import the package does not list", async () => {
    const dir = tree({ "package.json": { name: "app" }, "src/a.ts": `import { isRecord } from "ultimus";` });
    const { code, stderr } = await checkDeps(dir);
    expect(code).toBe(1);
    expect(stderr).toContain(".: ultimus (src/a.ts)");
  });

  test("fails on a library an npm script runs from node_modules", async () => {
    const dir = tree({ "package.json": { name: "app", scripts: { vibe: "bun node_modules/arrmatura-vibe/x.ts" } } });
    expect((await checkDeps(dir)).stderr).toContain("arrmatura-vibe (package.json)");
  });

  test("passes when the package lists it, and ignores node_modules and non-library imports", async () => {
    const dir = tree({
      "package.json": { name: "app", devDependencies: { ultimus: "file://../ultimus" } },
      "src/a.ts": `import { isRecord } from "ultimus/x"; import { z } from "zod";`,
      "node_modules/dep/index.ts": `import { App } from "arrmatura";`,
    });
    expect((await checkDeps(dir)).code).toBe(0);
  });

  test("a workspace package sees its root's dependencies, and is checked on its own", async () => {
    const dir = tree({
      "package.json": { name: "root", workspaces: ["packages/*"], devDependencies: { ultimus: "*" } },
      "packages/web/package.json": { name: "web" },
      "packages/web/src/a.ts": `import { isRecord } from "ultimus"; import { App } from "arrmatura";`,
    });
    const { code, stderr } = await checkDeps(dir);
    expect(code).toBe(1);
    expect(stderr).toContain("packages/web: arrmatura (src/a.ts)");
    expect(stderr).not.toContain("ultimus");
  });
});
