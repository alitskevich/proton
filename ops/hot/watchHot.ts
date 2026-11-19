import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, watch } from "node:fs";
import type http from "node:http";
import { join, resolve } from "node:path";
import { createDistTracker, hotEvent } from "./tracker.ts";

/** The endpoint of the front server the page follows; `HotReloadService` names the same path. */
const HOT_PATH = "/__hot";

/**
 * The hot reload endpoint: watches `folder` (the bundler's output) and streams each batch of changed files to every
 * page connected to `HOT_PATH` of the front server. Returns the request handler: true when it took the request.
 */
export function watchHot(folder: string) {
  const dir = resolve(folder);
  // The bundler may not have written its first build yet.
  mkdirSync(dir, { recursive: true });

  const clients = new Set<http.ServerResponse>();
  const tracker = createDistTracker({
    fingerprint: (name) => {
      const file = join(dir, name);
      return existsSync(file) ? createHash("sha1").update(readFileSync(file, "utf8")).digest("hex") : null;
    },
    emit: (files) => {
      for (const client of clients) client.write(hotEvent(files));
      console.log(`hot: ${files.join(", ")} → ${clients.size} page(s)`);
    },
  });
  for (const name of readdirSync(dir)) tracker.seed(name);
  watch(dir, (_event, name) => name && tracker.touch(name));

  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.method !== "GET" || new URL(req.url ?? "/", "http://localhost").pathname !== HOT_PATH) return false;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(": connected\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return true;
  };
}
