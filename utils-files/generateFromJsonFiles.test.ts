import { afterEach, describe, expect, it, vi } from "vitest";
import { generateFromJsonFiles } from "./generateFromJsonFiles.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateFromJsonFiles", () => {
  it("runs once and does not watch without --watch", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const generate = vi.fn();
    generateFromJsonFiles(import.meta.dirname, generate);
    expect(generate).toHaveBeenCalledOnce();
    expect(log).not.toHaveBeenCalled();
  });

  it("lets a failed first run throw", () => {
    const failing = () => {
      throw new Error("boom");
    };
    expect(() => generateFromJsonFiles(import.meta.dirname, failing)).toThrow("boom");
  });
});
