// esbuild dev server with watch, run from an app's directory: `bun ../proton/ops/serve.ts`.
//
//   PORT, HOST     where the app is served (default localhost:8080)
//   WWW            servedir when package.json names none (default ./www)
//   FALLBACK       the page for unknown paths (default <servedir>/index.html)
//   PROXY_PORT     put a live-reload front server on this port; esbuild stays on PORT
//   PROXY          an app back end: requests under PROXY_PATHS (comma-separated) go to it.
//                  The front server then takes PORT and esbuild moves to a loopback port.
//
// Live reload lives in the front server, so it is on whenever PROXY_PORT or PROXY is set.

import http from "node:http";
import * as esbuild from "esbuild";
import { readFileJsonContent } from "./utils/files";
import { getEsbuildOptions } from "./utils/getEsbuildOptions";

const LIVERELOAD_PATH = "/__livereload";
const INJECT_SCRIPT = `<script>new EventSource("${LIVERELOAD_PATH}").onmessage=()=>location.reload()</script>`;
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

function makeLiveReloadPlugin(clients: Set<http.ServerResponse>): esbuild.Plugin {
  return {
    name: "live-reload",
    setup(build) {
      build.onEnd(() => {
        for (const client of clients) {
          client.write("data: reload\n\n");
        }
        if (clients.size > 0) {
          console.log(`♻️  Hot reload sent to ${clients.size} client(s)`);
        }
      });
    },
  };
}

/** Where the front server sends requests: esbuild, and optionally a back end for some paths. */
type Upstreams = { bundler: { host: string; port: number }; backend?: string; backendPaths: string[] };

export async function main(options: any = {}) {
  try {
    const { name, esbuild: packageOptions = {} } = readFileJsonContent([`${process.cwd()}/package.json`]) ?? {};
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

    const proxyPort = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : backend ? port : undefined;
    // When the front server takes PORT, esbuild picks its own port on loopback.
    const bundlerOnLoopback = proxyPort === port;

    const clients = new Set<http.ServerResponse>();

    const ctx = await esbuild.context(
      getEsbuildOptions({
        ...packageBuildOptions,
        plugins: [makeLiveReloadPlugin(clients)],
        outdir: `${servedir}/dist`,
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
      onRequest: ({ method, path, status }) => {
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

    const upstreams: Upstreams = { bundler: { host: serveHosts[0], port: servePort }, backend, backendPaths };
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

main();

function startProxy(host: string, proxyPort: number, upstreams: Upstreams, clients: Set<http.ServerResponse>) {
  const { bundler, backend, backendPaths } = upstreams;
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";

    // SSE endpoint for hot reload
    if (url === LIVERELOAD_PATH) {
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
      if (contentType.includes("text/html")) {
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
