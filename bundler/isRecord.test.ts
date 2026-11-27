import { describe, expect, test } from "bun:test";
import { isRecord } from "./isRecord";

describe("isRecord", () => {
  test("is true for an object", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(new Error("boom"))).toBe(true);
  });

  test("is false for null, an array and a scalar", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord("text")).toBe(false);
  });
});
