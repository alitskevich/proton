import { describe, expect, it } from "bun:test";
import { pageRoute } from "./sitemap.ts";

describe("pageRoute", () => {
  it("is the path under dir, however dir is spelled", () => {
    for (const dir of ["docs", "./docs", "docs/", "./docs/"]) expect(pageRoute(dir, "docs/a/b.md")).toBe("a/b.md");
  });

  it("routes the index page to the root", () => {
    expect(pageRoute("./docs", "docs/index.md")).toBe("");
  });
});
