#!/usr/bin/env bash
#
# Usage: <path-to>/proton/ops/link-modules.sh
#
# First clones the library checkouts missing from the libs folder (clone-modules.sh).
# Then links the library checkouts of the libs folder (the one holding proton, ~/Projects/libs) into
# ./node_modules of the current directory, so the project builds and runs against library source:
# tsc, esbuild, bun test and Tailwind read each package's `exports` map from there. A library is a
# folder with a package.json; only those named in the current directory's package.json
# `dependencies`, `devDependencies` or `peerDependencies` are linked; neither the current directory nor proton itself is.

set -eu

proton="$(cd "$(dirname "$0")/.." && pwd)"
libs="$(dirname "$proton")"
"$proton/ops/clone-modules.sh" >&2
mkdir -p node_modules
wanted="$(jq -r '((.dependencies // {}) + (.devDependencies // {}) + (.peerDependencies // {})) | keys[]' package.json)"

for src in "$libs"/*/; do
  src="${src%/}"
  [ -f "$src/package.json" ] || continue
  [ "$src" -ef "$PWD" ] && continue
  [ "$src" -ef "$proton" ] && continue
  pkg="$(basename "$src")"
  printf '%s\n' "$wanted" | grep -qx -- "$pkg" || continue
  # npm may have installed a published copy here. `ln -sfn` cannot replace a directory — it
  # would link *inside* it — so clear it first; an existing link is replaced in place.
  [ -L "node_modules/$pkg" ] || rm -rf "node_modules/$pkg"
  ln -sfn "$src" "node_modules/$pkg"
  echo "linked: $src"
done
