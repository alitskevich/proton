#!/usr/bin/env bash
#
# Usage: <path-to>/proton/ops/link-modules.sh
#
# Links every library checkout in the libs folder (the one holding proton, ~/Projects/libs) into
# ./node_modules of the current directory, so the project builds and runs against library source:
# tsc, esbuild, vitest and Tailwind read each package's `exports` map from there. A library is a
# folder with a package.json; the current directory itself is never linked. Run from an app's root
# by `npm run link` / `postinstall`. Safe to re-run. Arguments are ignored: every library is linked.
# Not for the libraries themselves: a library in libs/ lists the siblings it needs as `file:` deps.

set -eu

libs="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p node_modules

for src in "$libs"/*/; do
  src="${src%/}"
  [ -f "$src/package.json" ] || continue
  [ "$src" -ef "$PWD" ] && continue
  pkg="$(basename "$src")"
  # npm may have installed a published copy here. `ln -sfn` cannot replace a directory — it
  # would link *inside* it — so clear it first; an existing link is replaced in place.
  [ -L "node_modules/$pkg" ] || rm -rf "node_modules/$pkg"
  ln -sfn "$src" "node_modules/$pkg"
  echo "linked node_modules/$pkg -> $src"
done
