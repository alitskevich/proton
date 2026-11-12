import { describe, expect, it } from "vitest";
import { isProcessAlive } from "./isProcessAlive.ts";

describe("isProcessAlive", () => {
  it("is true for this process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it("is true for a live process of another user (EPERM)", () => {
    expect(isProcessAlive(1)).toBe(true);
  });

  it("is false for a pid that does not exist, or no pid at all", () => {
    expect(isProcessAlive(2 ** 22 + 1)).toBe(false);
    expect(isProcessAlive(Number.NaN)).toBe(false);
  });
});
