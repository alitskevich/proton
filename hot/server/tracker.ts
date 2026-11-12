/**
 * The hot server's change tracker, pure over `fingerprint` and `emit`: `main.ts` feeds it the names
 * `fs.watch` reports. A burst of writes is reported once, `HOT_SETTLE_MS` after the last of them, and
 * only the files whose content changed; a source map is never reported.
 */

import { HOT_SETTLE_MS } from "../config";

type TrackerOptions = {
  /** The content's fingerprint of a file in the folder, or `null` when there is no such file. */
  fingerprint: (name: string) => string | null;
  /** Receives each batch of changed file names, sorted. */
  emit: (files: string[]) => void;
};

export function createDistTracker({ fingerprint, emit }: TrackerOptions) {
  const known = new Map<string, string>();
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush() {
    const changed = [...pending].filter((name) => {
      const print = fingerprint(name);
      if (print === null || known.get(name) === print) return false;
      known.set(name, print);
      return true;
    });
    pending.clear();
    if (changed.length) emit(changed.sort());
  }

  return {
    /** Records a file's current content, so a rewrite of the same content is not a change. */
    seed(name: string) {
      const print = fingerprint(name);
      if (print !== null) known.set(name, print);
    },

    touch(name: string) {
      if (name.endsWith(".map")) return;
      pending.add(name);
      clearTimeout(timer);
      timer = setTimeout(flush, HOT_SETTLE_MS);
    },
  };
}

/** One batch as a server-sent event: its `data` is the JSON array of the changed file names. */
export const hotEvent = (files: string[]) => `data: ${JSON.stringify(files)}\n\n`;
