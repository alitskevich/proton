import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { components } from "./index";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

describe("proton/hot", () => {
  it("registers HotReloadService alone", () => {
    expect(components.map((component) => component.name)).toEqual(["HotReloadService"]);
  });

  it("no client module imports a server half or node:*", () => {
    for (const file of ["index.ts", "config.ts", "HotReloadService.ts"]) {
      expect(read(file)).not.toMatch(/from "(node:|\.\.?\/server)/);
    }
  });
});
