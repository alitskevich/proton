import { describe, expect, test } from "vitest";
import { messageOf } from "./messageOf";

describe("messageOf", () => {
  test("reads the message of an Error", () => {
    expect(messageOf(new Error("boom"))).toBe("boom");
  });

  test("reads the message of a plain object", () => {
    expect(messageOf({ message: "denied", code: 403 })).toBe("denied");
  });

  test("is undefined for a value with no string message", () => {
    expect(messageOf("boom")).toBeUndefined();
    expect(messageOf(null)).toBeUndefined();
    expect(messageOf({ message: 42 })).toBeUndefined();
  });
});
