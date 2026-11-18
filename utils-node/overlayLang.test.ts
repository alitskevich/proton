import { afterEach, describe, expect, it } from "bun:test";
import { overlayLang } from "./overlayLang.ts";

const argv = process.argv;
afterEach(() => {
  process.argv = argv;
});

describe("overlayLang", () => {
  it("reads the language of --overlay=<lang>", () => {
    process.argv = ["node", "script", "src", "--overlay=nl"];
    expect(overlayLang()).toBe("nl");
  });

  it("is undefined without the flag or with an empty one", () => {
    process.argv = ["node", "script", "--watch"];
    expect(overlayLang()).toBeUndefined();
    process.argv = ["node", "script", "--overlay="];
    expect(overlayLang()).toBeUndefined();
  });
});
