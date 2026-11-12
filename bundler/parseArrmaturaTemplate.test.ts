import { describe, expect, test } from "vitest";
import { parseArrmaturaTemplate } from "./parseArrmaturaTemplate";

describe("parseArrmaturaTemplate", () => {
  test("returns each declared component with its parsed template, in source order", () => {
    const source = `<Component id="First"><div/></Component><Component id="Second"><span/></Component>`;

    const registry = parseArrmaturaTemplate(source);

    expect(registry.map(({ tag }) => tag)).toEqual(["First", "Second"]);
    expect(registry[0]?.template[0]?.tag).toBe("div");
    expect(registry[1]?.template[0]?.tag).toBe("span");
  });

  test("returns nothing for a source with no components", () => {
    expect(parseArrmaturaTemplate("")).toEqual([]);
  });
});
