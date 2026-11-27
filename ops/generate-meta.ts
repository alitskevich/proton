import { parseArgs } from "node:util";
import { generateFromJsonFiles } from "arrmatura-host/files";
import { generateMeta } from "../meta/generateMeta.ts";

// `proton generate-meta <outDir> [--meta=<dir>] [--no-zod] [--overlay=<lang>] [--watch]`:
//   proton generate-meta shared/meta
//   proton generate-meta src --meta=../../.meta
//   proton generate-meta resources/i18n --overlay=nl --no-zod
// `--meta` is the model folder (default `.meta`); `--no-zod` skips the Zod modules, for a project without `zod`;
// `--overlay=<lang>` writes that language's overlay; `--watch` regenerates on every `.json` change under the
// model folder, and a broken file is reported while the watch goes on. See `meta/generateMeta.ts`.
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    meta: { type: "string", default: ".meta" },
    "no-zod": { type: "boolean", default: false },
    overlay: { type: "string" },
    watch: { type: "boolean" },
  },
});
const [outDir] = positionals;
if (!outDir)
  throw new Error("usage: proton generate-meta <outDir> [--meta=<dir>] [--no-zod] [--overlay=<lang>] [--watch]");

const metaDir = values.meta;
const zod = !values["no-zod"];
const lang = values.overlay || undefined;

generateFromJsonFiles(metaDir, () => generateMeta({ metaDir, outDir, zod, lang }));
