import { generateFromJsonFiles } from "arrmatura-host/files";
import { generateMeta } from "../meta/generateMeta.ts";

const overlayLang = () => process.argv.find((a) => a.startsWith("--overlay="))?.slice("--overlay=".length) || undefined;

// `proton generate-meta <outDir> [--meta=<dir>] [--no-zod] [--overlay=<lang>] [--watch]`:
//   proton generate-meta shared/meta
//   proton generate-meta src --meta=../../.meta
//   proton generate-meta resources/i18n --overlay=nl --no-zod
// `--meta` is the model folder (default `.meta`); `--no-zod` skips the Zod modules, for a project without `zod`;
// `--overlay=<lang>` writes that language's overlay; `--watch` regenerates on every `.json` change under the
// model folder, and a broken file is reported while the watch goes on. See `meta/generateMeta.ts`.
const [outDir] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (!outDir)
  throw new Error("usage: proton generate-meta <outDir> [--meta=<dir>] [--no-zod] [--overlay=<lang>] [--watch]");

const metaDir = process.argv.find((arg) => arg.startsWith("--meta="))?.slice("--meta=".length) || ".meta";
const zod = !process.argv.includes("--no-zod");

generateFromJsonFiles(metaDir, () => generateMeta({ metaDir, outDir, zod, lang: overlayLang() }));
