import { readFileJsonContent } from "arrmatura-host/files";
import * as esbuild from "esbuild";
import { getEsbuildOptions } from "../bundler/getEsbuildOptions.ts";
import { messageOf } from "../bundler/messageOf.ts";
import { packageEsbuildOptions } from "../bundler/packageEsbuildOptions.ts";

async function main() {
  try {
    // The package.json `esbuild` block supplies the whole option set. Libraries emitting CJS for their `require`
    // condition need that; apps still get the browser/ESM defaults by naming only `entryPoints` and `outdir`.
    const { options } = packageEsbuildOptions(readFileJsonContent(`${process.cwd()}/package.json`));
    const buildOptions = getEsbuildOptions(options);

    // `--watch` keeps the process alive and rebuilds on change. Apps that run a library's dev
    // build alongside their own depend on it.
    if (process.argv.includes("--watch")) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log("👀 watching…");
      return;
    }

    await esbuild.build(buildOptions);
  } catch (error) {
    console.error("❌ Error:", messageOf(error) ?? error);
    process.exit(1);
  }
}

main();
