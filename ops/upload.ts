import { readFileJsonContent } from "arrmatura-host/files";
import { assert } from "ultimus";
import { isRecord } from "../bundler/isRecord.ts";
import { messageOf } from "../bundler/messageOf.ts";

const BATCH_SIZE = 500;

const { TARGET_URL, TOKEN = "" } = process.env;
const [, , fileArg, urlArg = TARGET_URL, token = TOKEN] = process.argv;
const url = assert(urlArg, "No url");
const file = assert(fileArg, "No file");

/** The rows of each store of a `{ store: rows[] }` bundle; throws on any other shape. */
function storesOf(bundle: unknown): [store: string, rows: unknown[]][] {
  if (!isRecord(bundle)) throw new Error(`${file}: not a { store: rows[] } bundle`);
  return Object.entries(bundle).map(([store, rows]) => {
    if (!Array.isArray(rows)) throw new Error(`${file}: ${store} is not an array of rows`);
    return [store, rows];
  });
}

/**
 * Posts every store's rows to `target` as `upsertBatch` actions of `BATCH_SIZE` rows. A batch the back end does not
 * answer with `{ data: { ok: true } }` throws, naming its store and offset: the rows after it are not sent.
 */
async function upload(target: string, bundle: unknown) {
  for (const [store, rows] of storesOf(bundle)) {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      console.log(">>> upload", store, i, "/", rows.length);
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const body = { data: { action: "upsertBatch", data: { [store]: chunk } } };
      const headers = { "Content-Type": "application/json", Authorization: token };
      const result = await fetch(target, { method: "POST", body: JSON.stringify(body), headers });

      const out: unknown = await result.json().catch(() => null);
      const reply = isRecord(out) && isRecord(out.data) ? out.data : {};
      if (!result.ok || reply.ok !== true) {
        const reason = reply.error ?? `HTTP ${result.status}`;
        throw new Error(`${store} @${i}: ${typeof reason === "string" ? reason : JSON.stringify(reason)}`);
      }
      console.log("<<< ok");
    }
  }
  console.log("<<< done");
}

upload(url, readFileJsonContent(file)).catch((error) => {
  console.error(messageOf(error) ?? error);
  process.exit(1);
});
