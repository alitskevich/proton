import { describe, expect, it } from "bun:test";
import { requireKey } from "./requireKey.ts";

describe("requireKey", () => {
  it("returns the value of a set key", () => {
    expect(requireKey("A", "the console", { A: "value" })).toBe("value");
  });

  it("names the key and where to take it from when it is missing or empty", () => {
    expect(() => requireKey("A", "the console", {})).toThrow(
      "A is not in ~/.keys/.env or the env; take it from the console",
    );
    expect(() => requireKey("A", "the console", { A: "" })).toThrow(/^A is not in/);
  });
});
