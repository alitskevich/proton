import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isLocalHost, isLocalOrigin, LOCAL_HOSTNAMES } from "./index";

describe("isLocalHost / isLocalOrigin", () => {
  it.each(LOCAL_HOSTNAMES)("isLocalHost is true for %s", (hostname) => {
    expect(isLocalHost(hostname)).toBe(true);
  });

  it("isLocalHost is false for a deployed host", () => {
    expect(isLocalHost("example.web.app")).toBe(false);
  });

  it("isLocalOrigin reads the hostname of an origin", () => {
    expect(isLocalOrigin("http://localhost:8189")).toBe(true);
    expect(isLocalOrigin("http://127.0.0.1:8089")).toBe(true);
    expect(isLocalOrigin("http://[::1]:8089")).toBe(true);
    expect(isLocalOrigin("https://example.web.app")).toBe(false);
  });

  it("isLocalOrigin is false for a malformed origin", () => {
    expect(isLocalOrigin("not a url")).toBe(false);
    expect(isLocalOrigin("")).toBe(false);
  });

  it("imports neither node:* nor a server half, so the browser bundle can take it", () => {
    expect(readFileSync(new URL("index.ts", import.meta.url), "utf8")).not.toMatch(/from "(node:|[^"]*\/server)/);
  });
});
