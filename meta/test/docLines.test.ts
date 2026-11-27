import { describe, expect, it } from "bun:test";
import { docLines } from "../impl/docLines.ts";

describe("docLines", () => {
  it("writes a note as a doc comment, each line indented", () => {
    expect(docLines("a\nb", { indent: "  " })).toEqual(["  /**", "   * a", "   * b", "   */"]);
  });

  it("writes a note as // lines when line", () => {
    expect(docLines("a\nb", { line: true })).toEqual(["// a", "// b"]);
  });

  it("writes nothing for no note", () => {
    expect(docLines(undefined)).toEqual([]);
    expect(docLines("")).toEqual([]);
  });
});
