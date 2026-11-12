import { describe, expect, it } from "vitest";
import { isChanged, withVersion } from "./HotReloadService";

describe("isChanged", () => {
  const ORIGIN = "http://localhost:8089";

  it("matches a same-origin file by its name, whatever its query", () => {
    expect(isChanged(`${ORIGIN}/dist/index.css`, ["index.css"], ORIGIN)).toBe(true);
    expect(isChanged(`${ORIGIN}/dist/index.js?v=17`, ["index.css", "index.js"], ORIGIN)).toBe(true);
  });

  it("is false for a file the batch does not name", () => {
    expect(isChanged(`${ORIGIN}/dist/index.css`, ["index.js"], ORIGIN)).toBe(false);
    expect(isChanged(`${ORIGIN}/dist/myindex.css`, ["index.css"], ORIGIN)).toBe(false);
  });

  it("is false for another origin's file of the same name", () => {
    expect(isChanged("https://unpkg.com/lib/index.css", ["index.css"], ORIGIN)).toBe(false);
  });
});

describe("withVersion", () => {
  it("sets the v query parameter, replacing an earlier one", () => {
    expect(withVersion("http://localhost:8089/dist/index.js", 1)).toBe("http://localhost:8089/dist/index.js?v=1");
    expect(withVersion("http://localhost:8089/dist/index.js?v=1", 2)).toBe("http://localhost:8089/dist/index.js?v=2");
  });
});
