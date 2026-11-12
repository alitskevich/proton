/**
 * The hot dev server, run by bun: `bun devops/hot/server/main.ts <dir> <port>` watches `dir` (the
 * bundler's output) and streams each batch of changed files to every page connected to `HOT_PATH`,
 * on 127.0.0.1 at `port`. Dev only; nothing here is deployed.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, watch } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { isLocalOrigin } from "../../local";
import { HOT_HOST, HOT_PATH } from "../config";
import { createDistTracker, hotEvent } from "./tracker";

const [dirArg, portArg] = process.argv.slice(2);
const hotPort = Number(portArg);
if (!dirArg || !Number.isInteger(hotPort)) {
  console.error("hot server: pass the folder to watch and the port to serve on");
  process.exit(1);
}
const dir = resolve(dirArg);
// The bundler may not have written its first build yet.
mkdirSync(dir, { recursive: true });

const clients = new Set<ServerResponse>();

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

const server = createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && !isLocalOrigin(origin)) return res.writeHead(403).end();
  if (req.method !== "GET" || new URL(req.url ?? "/", `http://${HOT_HOST}`).pathname !== HOT_PATH) {
    return res.writeHead(404).end();
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  res.write(": connected\n\n");
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

// A page stays connected for as long as it is open.
server.requestTimeout = 0;
server.timeout = 0;

server.listen(hotPort, HOT_HOST, () => {
  console.log(`hot server on http://${HOT_HOST}:${hotPort}${HOT_PATH} → ${dir}`);
});
