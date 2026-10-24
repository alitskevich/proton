import * as esbuild from "esbuild";
import { readFileJsonContent } from "./utils/files";
import { getEsbuildOptions } from "./utils/getEsbuildOptions";

export async function main(options: any = {}) {
  try {
    // The package.json `esbuild` block supplies the WHOLE option set — `format`, `outExtension`,
    // `packages`, anything esbuild accepts — not just entry points. Libraries emitting CJS for
    // their `require` condition need that; apps still get the browser/ESM defaults by naming
    // only `entryPoints` and `outdir`. An explicit argument outranks the file.
    const { esbuild: packageOptions = {} } = readFileJsonContent([`${process.cwd()}/package.json`]) ?? {};

    // `servedir` is a dev-server-only option (serve.ts reads it directly); esbuild.build()
    // rejects it outright, so it must not survive into these options.
    const { servedir: _servedir, ...buildPackageOptions } = packageOptions;

    const buildOptions = getEsbuildOptions({ ...buildPackageOptions, ...options });

    // `--watch` keeps the process alive and rebuilds on change. Apps that run a library's dev
    // build alongside their own depend on it.
    if (process.argv.includes("--watch")) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log("👀 watching…");
      return;
    }

    await esbuild.build(buildOptions);
  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
    if (err.details) {
      console.error(err.details);
    }
    process.exit(1);
  }
}

main();
