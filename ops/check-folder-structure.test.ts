import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileContent } from "arrmatura-host/files";

const SCRIPT = `${import.meta.dir}/check-folder-structure.ts`;
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** A project in a temp git repo: path → content, a package.json given as an object. */
function tree(files: Record<string, string | object>) {
  const dir = mkdtempSync(join(tmpdir(), "arrmatura-support-check-folder-structure-"));
  dirs.push(dir);
  for (const [path, content] of Object.entries(files)) {
    writeFileContent(join(dir, path), typeof content === "string" ? content : JSON.stringify(content));
  }
  Bun.spawnSync(["git", "init", "-q"], { cwd: dir });
  Bun.spawnSync(["git", "add", "-A"], { cwd: dir });
  return dir;
}

/** Runs the script as `arrmatura-support check-folder-structure` does, in `cwd`. */
async function check(cwd: string, ...args: string[]) {
  const child = Bun.spawn([process.execPath, SCRIPT, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

const fn = (name: string, body = "") => `${body}export function ${name}() {\n  return 1;\n}\n`;

describe("check-folder-structure", () => {
  test("passes when the public function sits beside the barrel and the internal one in impl/", async () => {
    const dir = tree({
      "package.json": { name: "app" },
      "src/index.ts": `export * from "./pub";\n`,
      "src/pub.ts": fn("pub", `import { priv } from "./impl/priv";\n`),
      "src/impl/priv.ts": fn("priv"),
    });
    const { code, stdout } = await check(dir);
    expect(code).toBe(0);
    expect(stdout).toContain("every function file is at home");
  });

  test("fails on an internal function outside impl/, and on a public one inside it", async () => {
    const dir = tree({
      "package.json": { name: "app" },
      "src/a/index.ts": `export * from "./impl/shared";\n`,
      "src/a/impl/shared.ts": fn("shared"),
      "src/a/user.ts": `import { helper } from "./helper";\nexport class User {}\n`,
      "src/a/helper.ts": fn("helper"),
    });
    const { code, stderr } = await check(dir);
    expect(code).toBe(1);
    expect(stderr).toContain("src/a/impl/shared.ts → src/a/shared.ts");
    expect(stderr).toContain("src/a/helper.ts → src/a/impl/helper.ts");
  });

  test("an outside import by package name makes a function public; a test never does", async () => {
    const dir = tree({
      "package.json": { name: "root", workspaces: ["packages/*"] },
      "packages/lib/package.json": { name: "lib" },
      "packages/lib/calc/impl/total.ts": fn("total"),
      "packages/lib/calc/impl/onlyTested.ts": fn("onlyTested"),
      "packages/lib/calc/Calc.ts": `import { onlyTested } from "./impl/onlyTested";\nexport class Calc {}\n`,
      "packages/app/main.ts": `import { total } from "lib/calc/impl/total";\n`,
      "tests/onlyTested.test.ts": `import { onlyTested } from "lib/calc/impl/onlyTested";\n`,
    });
    const { stderr } = await check(dir);
    expect(stderr).toContain("packages/lib/calc/impl/total.ts → packages/lib/calc/total.ts");
    expect(stderr).not.toContain("onlyTested.ts →");
  });

  test("--fix moves the files and repoints every path, in the form each was written", async () => {
    const dir = tree({
      "package.json": { name: "app" },
      "data.json": "{}",
      "src/index.ts": `export * from "./impl/pub.ts";\n`,
      "src/impl/pub.ts": fn("pub", `import data from "../../data.json";\nimport { deep } from "./deep";\n`),
      "src/impl/deep.ts": fn("deep"),
      "src/test/pub.test.ts": `import { pub } from "../impl/pub";\n`,
    });
    const { code } = await check(dir, "--fix");
    expect(code).toBe(0);
    expect(existsSync(join(dir, "src/impl/pub.ts"))).toBe(false);
    expect(readFileSync(join(dir, "src/index.ts"), "utf8")).toContain(`from "./pub.ts"`);
    const moved = readFileSync(join(dir, "src/pub.ts"), "utf8");
    expect(moved).toContain(`from "../data.json"`);
    expect(moved).toContain(`from "./impl/deep"`);
    expect(readFileSync(join(dir, "src/test/pub.test.ts"), "utf8")).toContain(`from "../pub"`);
    expect((await check(dir)).code).toBe(0);
  });

  test("warns on a function file nothing imports, and leaves it in place", async () => {
    const dir = tree({ "package.json": { name: "app" }, "src/lonely.ts": fn("lonely") });
    const { code, stderr } = await check(dir);
    expect(code).toBe(0);
    expect(stderr).toContain("1 function file(s) nothing imports");
  });
});
