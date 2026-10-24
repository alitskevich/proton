import { assert } from "ultimus";
import { readFileJsonContent } from "./utils/files";

const { TARGET_URL, TOKEN } = process.env;
const [, , file, url = TARGET_URL, token = TOKEN] = process.argv;

assert(url, "No url");
assert(file, "No file");

console.log(url, file);

/**
 * Uploads data to the specified URL.
 *
 * @param url - The URL to upload data to.
 * @param store - The store where the data will be stored.
 * @param data - The data to upload
 */
async function doUpstream(
  url,
  bundle: Record<string, any[]>,
  { portion = 500, token = "", action = "upsertBatch" }: any = {}
) {
  for (const store in bundle) {
    const data = bundle[store];
    for (let i = 0; i < data.length; i += portion) {
      console.log(">>> doUpstream ", store, i, "/", data.length);
      const chunk = data.slice(i, i + portion);
      // console.log("Uploading", chunk.length, chunk.map((e) => JSON.stringify(e)).join("\n"));
      const body = {
        action,
        data: {
          [store]: chunk,
        },
      };

      const result = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ data: body }),
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      });

      const out: any = await result.json();
      if (out?.data?.ok) {
        console.log("<<< ok");
      } else {
        console.log("<<< error", out.data?.error);
      }
    }
  }
  console.log("<<< done");
}

const data = readFileJsonContent(file);

doUpstream(url, data, { token });
