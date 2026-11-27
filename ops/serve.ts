// esbuild dev server with watch, run from an app's directory: `bun ../proton/ops/serve.ts`.
//
//   PORT, HOST     where the app is served (default localhost:8080)
//   WWW            servedir when package.json names none (default ./www)
//   FALLBACK       the page for unknown paths (default <servedir>/index.html)
//   PROXY_PORT     put a live-reload front server on this port; esbuild stays on PORT
//   PROXY          an app back end: requests under PROXY_PATHS (comma-separated) go to it.
//                  The front server then takes PORT and esbuild moves to a loopback port.
//
// Live reload lives in the front server, so it is on whenever PROXY_PORT or PROXY is set, unless --hot.
//
//   --hot          hot reload (see arrmatura-web/modules/hot/README.md): the front server takes PORT and streams each batch of changed
//                  files of the bundle's output folder to the pages connected to its `HOT_PATH`. A page is
//                  relaunched in place, so this replaces the page reload of PROXY_PORT / PROXY.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, watch } from "node:fs";
import http from "node:http";
import { join, resolve } from "node:path";
import { readFileJsonContent } from "arrmatura-host/files";
import * as esbuild from "esbuild";
import { getEsbuildOptions } from "../bundler/getEsbuildOptions";

const LIVERELOAD_PATH = "/__livereload";
const INJECT_SCRIPT = `<script>new EventSource("${LIVERELOAD_PATH}").onmessage=()=>location.reload()</script>`;
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

// esbuild's own change stream, which sends `change` only when the build output differs. Not `onEnd`: under
// `serve`, every request rebuilds, so a reload sent on each build makes the reloaded page reload again, forever.
const ESBUILD_EVENTS_PATH = "/esbuild";
const RECONNECT_MS = 500;

/** Relay esbuild's `change` events to the live-reload clients, reconnecting when the stream drops. */
function relayChanges(bundler: Upstreams["bundler"], clients: Set<http.ServerResponse>) {
  let retried = false;
  const retry = () => {
    if (retried) return;
    retried = true;
    setTimeout(() => relayChanges(bundler, clients), RECONNECT_MS);
  };
  const headers = { Accept: "text/event-stream" };
  const req = http.get({ hostname: bundler.host, port: bundler.port, path: ESBUILD_EVENTS_PATH, headers }, (res) => {
    res.setEncoding("utf8");
    res.on("data", (chunk: string) => {
      if (!chunk.includes("event: change")) return;
      for (const client of clients) client.write("data: reload\n\n");
      if (clients.size > 0) console.log(`♻️  Hot reload sent to ${clients.size} client(s)`);
    });
    res.on("end", retry);
  });
  req.on("error", retry);
}

// Hot reload (--hot): `watchHot` watches the bundle's output folder and streams each batch of changed files.
// The tracker is pure over `fingerprint` and `emit`: a burst of writes is reported once, `HOT_SETTLE_MS` after
// the last of them, and only the files whose content changed; a source map is never reported.

const HOT_SETTLE_MS = 2_000;

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

/** The endpoint of the front server the page follows; `HotReloadService` names the same path. */
const HOT_PATH = "/__hot";

/**
 * The hot reload endpoint: watches `folder` (the bundler's output) and streams each batch of changed files to every
 * page connected to `HOT_PATH` of the front server. Returns the request handler: true when it took the request.
 */
function watchHot(folder: string) {
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

/** Where the front server sends requests: esbuild, and optionally a back end for some paths. */
type Upstreams = {
  bundler: { host: string; port: number };
  backend?: string;
  backendPaths: string[];
  /** The hot reload handler; with it, the page is relaunched in place and never reloaded. */
  hot?: (req: http.IncomingMessage, res: http.ServerResponse) => boolean;
};

export async function main(options: any = {}) {
  try {
    const { name, esbuild: packageOptions = {} } = (readFileJsonContent(`${process.cwd()}/package.json`) as any) ?? {
      name: "client",
      esbuild: {},
    };
    // As in build.ts, the package.json `esbuild` block is the whole option set; `servedir` is
    // this server's own and esbuild rejects it.
    const { servedir: packageServedir, ...packageBuildOptions } = packageOptions;

    const {
      servedir = packageServedir ?? process.env.WWW ?? "./www",
      fallback = process.env.FALLBACK ?? `${servedir}/index.html`,
      port = parseInt(process.env.PORT ?? "8080", 10),
      host = process.env.HOST ?? "localhost",
      backend = process.env.PROXY,
      backendPaths = process.env.PROXY_PATHS?.split(",").filter(Boolean) ?? [],
      noWatch = false,
      ...buildOptions
    } = options;

    const hot = process.argv.includes("--hot");
    const outdir = buildOptions.outdir ?? `${servedir}/dist`;
    const proxyPort = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : backend || hot ? port : undefined;
    // When the front server takes PORT, esbuild picks its own port on loopback.
    const bundlerOnLoopback = proxyPort === port;

    const clients = new Set<http.ServerResponse>();

    const ctx = await esbuild.context(
      getEsbuildOptions({
        ...packageBuildOptions,
        outdir,
        // Dev only: link the map so devtools pick it up. Production builds (build.ts) keep
        // the "external" default, which emits no sourceMappingURL reference.
        sourcemap: "linked",
        ...buildOptions,
      }),
    );

    if (!noWatch) {
      await ctx.watch();
    }

    const serveOptions = {
      servedir,
      fallback,
      ...(bundlerOnLoopback ? { host: "127.0.0.1" } : { port, host }),
      onRequest: ({ method, path, status }: any) => {
        console.log(`>> ${method}${path} - ${status}`);
      },
    };

    const { hosts: serveHosts, port: servePort } = await ctx.serve(serveOptions);

    const addresses = (hosts: string[], port: number) =>
      String(hosts)
        .split(",")
        .map((h) => `http://${h}:${port}`)
        .join(" ");

    if (proxyPort === undefined) {
      console.log(`✅ Serving "${name}" app at ${addresses(serveHosts, servePort)} from ${servedir}`);
      return;
    }

    const upstreams: Upstreams = {
      bundler: { host: serveHosts[0], port: servePort },
      backend,
      backendPaths,
      hot: hot ? watchHot(outdir) : undefined,
    };
    await startProxy(host, proxyPort, upstreams, clients);

    if (!bundlerOnLoopback) {
      console.log(`✅ Serving "${name}" app at ${addresses(serveHosts, servePort)} from ${servedir}`);
    }
    console.log(`✅ Serving "${name}" app at ${addresses([host], proxyPort)} from ${servedir} (hot reload enabled)`);
    if (backend) console.log(`↪ ${backendPaths.join(" ")} → ${backend}`);
  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
    if (err.details) {
      console.error(err.details);
    }
    process.exit(1);
  }
}

if (import.meta.main) main();

function startProxy(host: string, proxyPort: number, upstreams: Upstreams, clients: Set<http.ServerResponse>) {
  const { bundler, backend, backendPaths, hot } = upstreams;
  if (!hot) relayChanges(bundler, clients);
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";

    if (hot?.(req, res)) return;

    // SSE endpoint for live reload
    if (!hot && url === LIVERELOAD_PATH) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    // The back end's routes pass through untouched.
    if (backend && backendPaths.some((path) => url.startsWith(path))) {
      const backendReq = http.request(
        `${backend}${url}`,
        { method: req.method, headers: req.headers },
        (backendRes) => {
          res.writeHead(backendRes.statusCode ?? 502, backendRes.headers);
          backendRes.pipe(res);
        },
      );
      backendReq.on("error", (error) => {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end(`${backend} is down: ${error.message}`);
      });
      req.pipe(backendReq);
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(200, CORS_HEADERS);
      res.end("");
      return;
    }

    const options = {
      hostname: bundler.host,
      port: bundler.port,
      path: url,
      method: req.method,
      headers: req.headers,
    };

    // Forward each incoming request to esbuild
    const proxyReq = http.request(options, (proxyRes) => {
      // If esbuild returns "not found", send a custom 404 page
      if (proxyRes.statusCode === 404) {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>A custom 404 page</h1>");
        return;
      }

      const contentType = proxyRes.headers["content-type"] ?? "";

      // Inject live-reload script into HTML responses
      if (!hot && contentType.includes("text/html")) {
        const chunks: Uint8Array[] = [];
        proxyRes.on("data", (chunk) => chunks.push(chunk));
        proxyRes.on("end", () => {
          let html = Buffer.concat(chunks).toString();
          html = html.includes("</body>") ? html.replace("</body>", `${INJECT_SCRIPT}</body>`) : html + INJECT_SCRIPT;
          const buf = Buffer.from(html);
          res.writeHead(proxyRes.statusCode ?? 200, {
            ...proxyRes.headers,
            ...CORS_HEADERS,
            "content-length": buf.length,
          });
          res.end(buf);
        });
        return;
      }

      // Otherwise, forward the response from esbuild to the client
      res.writeHead(proxyRes.statusCode ?? 200, { ...proxyRes.headers, ...CORS_HEADERS });
      proxyRes.pipe(res, { end: true });
    });

    // Forward the body of the request to esbuild
    req.pipe(proxyReq, { end: true });
  });
  return new Promise<void>((resolve) => server.listen(proxyPort, host, () => resolve()));
}
