import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOT_SETTLE_MS } from "../config";
import { createDistTracker, hotEvent } from "./tracker";

describe("createDistTracker", () => {
  /** A dist folder held in memory: name → fingerprint; a missing name has no file. */
  function setup(initial: Record<string, string> = {}) {
    const files = new Map(Object.entries(initial));
    const batches: string[][] = [];
    const tracker = createDistTracker({ fingerprint: (name) => files.get(name) ?? null, emit: (b) => batches.push(b) });
    const write = (name: string, content: string) => {
      files.set(name, content);
      tracker.touch(name);
    };
    return { files, batches, tracker, write };
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reports a burst of writes once, sorted, after the writes settle", () => {
    const { batches, write } = setup();
    write("index.js", "a");
    write("index.css", "b");
    write("index.js", "c");
    vi.advanceTimersByTime(HOT_SETTLE_MS - 1);
    expect(batches).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(batches).toEqual([["index.css", "index.js"]]);
  });

  it("debounces: each write within the window restarts it, so a spread-out rebuild is one batch", () => {
    const { batches, write } = setup();
    write("index.css", "a");
    vi.advanceTimersByTime(HOT_SETTLE_MS - 1);
    write("index.js", "b");
    vi.advanceTimersByTime(HOT_SETTLE_MS - 1);
    expect(batches).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(batches).toEqual([["index.css", "index.js"]]);
  });

  it("never reports a source map", () => {
    const { batches, write } = setup();
    write("index.js.map", "a");
    vi.advanceTimersByTime(HOT_SETTLE_MS);
    expect(batches).toEqual([]);
  });

  it("drops a file rewritten with the content it had", () => {
    const { batches, write } = setup();
    write("index.css", "a");
    vi.advanceTimersByTime(HOT_SETTLE_MS);
    write("index.css", "a");
    write("index.js", "b");
    vi.advanceTimersByTime(HOT_SETTLE_MS);
    expect(batches).toEqual([["index.css"], ["index.js"]]);
  });

  it("knows a seeded file's content, so rewriting it unchanged reports nothing", () => {
    const { batches, tracker, write } = setup({ "index.css": "a" });
    tracker.seed("index.css");
    write("index.css", "a");
    vi.advanceTimersByTime(HOT_SETTLE_MS);
    expect(batches).toEqual([]);
  });

  it("drops a file that is gone by the time the writes settle", () => {
    const { batches, files, write } = setup();
    write("index.js", "a");
    files.delete("index.js");
    vi.advanceTimersByTime(HOT_SETTLE_MS);
    expect(batches).toEqual([]);
  });
});

describe("hotEvent", () => {
  it("frames a batch as one server-sent event carrying its JSON", () => {
    expect(hotEvent(["index.css", "index.js"])).toBe('data: ["index.css","index.js"]\n\n');
  });
});
