import { describe, expect, it } from "bun:test";
import { literalBody } from "../impl/literalBody.ts";

/** The regex literal `/<body>/` as source code evaluates to: a syntax error throws. */
const literal = (pattern: string) => new Function(`return /${literalBody(pattern)}/;`)() as RegExp;

describe("literalBody", () => {
  it("escapes a bare slash", () => {
    expect(literalBody("a/b")).toBe("a\\/b");
    expect(literal("a/b").test("a/b")).toBe(true);
  });

  it("escapes the slash after an escaped backslash", () => {
    expect(literalBody("a\\\\/b")).toBe("a\\\\\\/b");
    expect(literal("a\\\\/b").test("a\\/b")).toBe(true);
  });

  it("keeps an escaped slash as it is", () => {
    expect(literalBody("a\\/b")).toBe("a\\/b");
    expect(literal("a\\/b").test("a/b")).toBe(true);
  });

  it("keeps a slash inside a character class", () => {
    expect(literalBody("[/]")).toBe("[/]");
    expect(literal("a[/]b").test("a/b")).toBe(true);
  });

  it("ends a class at its first unescaped bracket", () => {
    expect(literalBody("[\\]]/")).toBe("[\\]]\\/");
    expect(literal("[\\]]/").test("]/")).toBe(true);
  });
});
