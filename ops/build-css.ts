/// <reference types="node" />
// Builds a project's Tailwind CSS. Run from the project root, as its `npm run build:css`:
//
//   bun node_modules/proton/ops/build-css.ts [input] [output] [--watch] [--minify]
//
// `input` defaults to `index.css` and `output` to `www/dist/index.css`, both relative to the
// current directory. Every `-`-prefixed argument passes through to the Tailwind CLI, so
// `npm run build:css -- --watch` keeps working.
//
// The CLI is proton's own dependency, not the project's: `npx @tailwindcss/cli` fails with
// "tailwindcss: command not found" wherever a linked library brings the package into the tree
// without its bin.

import { fileURLToPath } from "node:url";
import { runCommand } from "../utils-node/index.ts";

const tailwind = fileURLToPath(new URL("../node_modules/.bin/tailwindcss", import.meta.url));

const args = process.argv.slice(2);
const flags = args.filter((arg) => arg.startsWith("-"));
const [input = "index.css", output = "www/dist/index.css"] = args.filter((arg) => !arg.startsWith("-"));

runCommand(tailwind, ["-i", input, "-o", output, ...flags]);
