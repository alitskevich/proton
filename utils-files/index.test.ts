import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as barrel from "./index.ts";

const SRC_DIR = import.meta.dirname;
const modules = readdirSync(SRC_DIR)
  .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts" && file !== "types.ts")
  .map((file) => file.slice(0, -3));
const load = (name: string) => {
  const file = join(SRC_DIR, `${name}.ts`);
  return import(/* @vite-ignore */ file);
};

/** A Node module file: one doc line and one re-export from that module. */
const REEXPORT = /^\/\*\*.*\*\/\nexport \{([\w,\s]+)\} from "(node:[\w/]+)";\n$/;
const reexportOf = (name: string) => {
  const file = join(SRC_DIR, `${name}.ts`);
  return readFileSync(file, "utf8").match(REEXPORT);
};
const nodeModules = modules.filter(reexportOf);
/** The Node modules `utils-files` owns; `utils-node` owns all the others. */
const FILE_SYSTEM = ["node:fs", "node:fs/promises", "node:path"];
const helpers = modules.filter((name) => !reexportOf(name));

describe("utils-files", () => {
  it.each(helpers)("%s.ts exports exactly its same-named helper", async (name) => {
    const loaded = await load(name);
    expect(Object.keys(loaded)).toEqual([name]);
  });

  it.each(nodeModules)("%s.ts re-exports only Node's own functions", async (name) => {
    const [, list, specifier] = reexportOf(name) as RegExpMatchArray;
    const names = list.match(/\w+/g) as string[];
    expect(FILE_SYSTEM).toContain(specifier);
    const [node, own] = await Promise.all([import(specifier), load(name)]);
    for (const exportName of names) expect(own[exportName]).toBe(node[exportName]);
  });

  it("the barrel exports every file's exports and nothing else", async () => {
    const loading = modules.map(load);
    const all = (await Promise.all(loading)).flatMap((loaded) => Object.keys(loaded));
    expect(Object.keys(barrel).sort()).toEqual(all.sort());
    expect(new Set(all).size).toBe(all.length);
  });
});
