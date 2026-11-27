import { afterAll, describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { writeFileContent } from "arrmatura-host/files";

const SCRIPT = `${import.meta.dir}/upload.ts`;
const BUNDLE_FILE = `${tmpdir()}/proton-upload-${process.pid}.json`;
writeFileContent(BUNDLE_FILE, JSON.stringify({ rows: [{ id: 1 }, { id: 2 }] }));

/** A back end that answers every batch with `reply`, and the batches it got. */
function backend(reply: () => Response) {
  const batches: unknown[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (req) => {
      batches.push(await req.json());
      return reply();
    },
  });
  return { url: `http://localhost:${server.port}`, batches, stop: () => server.stop(true) };
}

/** Runs the script as `proton upload` does, against `url`. */
async function upload(url: string) {
  const child = Bun.spawn([process.execPath, SCRIPT, BUNDLE_FILE, url, "token"], { stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

const servers: (() => void)[] = [];
afterAll(() => {
  for (const stop of servers) stop();
});

describe("upload", () => {
  test("posts each store's rows as an upsertBatch and exits 0", async () => {
    const server = backend(() => Response.json({ data: { ok: true } }));
    servers.push(server.stop);
    const { code, stdout } = await upload(server.url);
    expect(code).toBe(0);
    expect(stdout).toContain("<<< done");
    expect(server.batches).toEqual([{ data: { action: "upsertBatch", data: { rows: [{ id: 1 }, { id: 2 }] } } }]);
  });

  test("a failed batch names its store and offset, and exits 1", async () => {
    const server = backend(() => Response.json({ data: { ok: false, error: "denied" } }));
    servers.push(server.stop);
    const { code, stdout, stderr } = await upload(server.url);
    expect(code).toBe(1);
    expect(stderr).toContain("rows @0: denied");
    expect(stdout).not.toContain("<<< done");
  });

  test("a non-JSON error reply exits 1 with its HTTP status", async () => {
    const server = backend(() => new Response("Internal error", { status: 500 }));
    servers.push(server.stop);
    const { code, stderr } = await upload(server.url);
    expect(code).toBe(1);
    expect(stderr).toContain("rows @0: HTTP 500");
  });
});
