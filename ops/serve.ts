import http from "node:http";
import * as esbuild from "esbuild";
import { readFileJsonContent } from "./utils/files";
import { getEsbuildOptions } from "./utils/getEsbuildOptions";

const LIVERELOAD_PATH = "/__livereload";
const INJECT_SCRIPT = `<script>new EventSource("${LIVERELOAD_PATH}").onmessage=()=>location.reload()</script>`;

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

export async function main(options: any = {}) {
  try {
    const { name, esbuild: esBuildPackageOpions } = readFileJsonContent([`${process.cwd()}/package.json`]) ?? {};

    const {
      entryPoints = esBuildPackageOpions?.entryPoints,
      servedir = esBuildPackageOpions?.servedir ?? process.env.WWW ?? "./www",
      fallback, //= `${servedir}/index.html`,
      port = parseInt(process.env.PORT ?? "8080", 10),
      host = process.env.HOST ?? "localhost",
      noWatch = false,
      ...buildOptions
    } = options;

    const clients = new Set<http.ServerResponse>();

    const ctx = await esbuild.context(
      getEsbuildOptions({
        entryPoints,
        plugins: [makeLiveReloadPlugin(clients)],
        outdir: `${servedir}/dist`,
        // Dev only: link the map so devtools pick it up. Production builds (build.ts) keep
        // the "external" default, which emits no sourceMappingURL reference.
        sourcemap: "linked",
        ...buildOptions,
      })
    );

    if (!noWatch) {
      await ctx.watch();
    }

    const serveOptions = {
      servedir,
      fallback,
      port,
      host,
      onRequest: ({ method, path, status }) => {
        console.log(`>> ${method}${path} - ${status}`);
      },
    };

    const { hosts: serveHosts, port: servePort } = await ctx.serve(serveOptions);

    const addresses = (port) =>
      String(serveHosts)
        .split(",")
        .map((h) => `http://${h}:${port}`)
        .join(" ");

    const proxyPort = process.env.PROXY_PORT; // 3000 + (servePort % 1000);
    if (proxyPort) {
      startProxy(serveHosts, port, Number(proxyPort), clients);
    }

    console.log(`✅ Serving "${name}" app at ${addresses(servePort)} from ${servedir}`);
    if (proxyPort) console.log(`Proxy at ${addresses(proxyPort)} (hot reload enabled)`);
  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
    if (err.details) {
      console.error(err.details);
    }
    process.exit(1);
  }
}

main();

function startProxy(serveHosts: string[], port: any, proxyPort: number, clients: Set<http.ServerResponse>) {
  http
    .createServer((req, res) => {
      // SSE endpoint for hot reload
      if (req.url === LIVERELOAD_PATH) {
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

      if (req.method === "OPTIONS") {
        res.writeHead(200, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" });
        res.end("");
        return;
      }

      const options = {
        hostname: serveHosts[0],
        port: port,
        path: req.url,
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
        const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

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
              ...corsHeaders,
              "content-length": buf.length,
            });
            res.end(buf);
          });
          return;
        }

        // Otherwise, forward the response from esbuild to the client
        res.writeHead(proxyRes.statusCode ?? 200, { ...proxyRes.headers, ...corsHeaders });
        proxyRes.pipe(res, { end: true });
      });

      // Forward the body of the request to esbuild
      req.pipe(proxyReq, { end: true });
    })
    .listen(proxyPort);
}
