#!/usr/bin/env bash
#
# Usage: <path-to>/proton/ops/link-modules.sh
#
# Links the library checkouts of the libs folder (the one holding proton, ~/Projects/libs) into
# ./node_modules of the current directory, so the project builds and runs against library source:
# tsc, esbuild, bun test and Tailwind read each package's `exports` map from there. A library is a
# folder with a package.json; only those named in the current directory's package.json
# `dependencies`, `devDependencies` or `peerDependencies` are linked, and the current directory itself never is.
# It also re-links node_modules/.bin/proton to this checkout.
# Run from a project's root by `npm run link` / `postinstall`. Safe to re-run. Arguments are ignored.

set -eu

libs="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p node_modules
wanted="$(jq -r '((.dependencies // {}) + (.devDependencies // {}) + (.peerDependencies // {})) | keys[]' package.json)"

for src in "$libs"/*/; do
  src="${src%/}"
  [ -f "$src/package.json" ] || continue
  [ "$src" -ef "$PWD" ] && continue
  pkg="$(basename "$src")"
  printf '%s\n' "$wanted" | grep -qx -- "$pkg" || continue
  # npm may have installed a published copy here. `ln -sfn` cannot replace a directory — it
  # would link *inside* it — so clear it first; an existing link is replaced in place.
  [ -L "node_modules/$pkg" ] || rm -rf "node_modules/$pkg"
  ln -sfn "$src" "node_modules/$pkg"
  echo "linked: $src"
done

# npm's `.bin/proton` may be stale (an older layout of this package) or missing: point it at the
# checkout's own `bin`, so `proton <script>` works in npm scripts right after linking.
proton="$(cd "$(dirname "$0")/.." && pwd)"
bin="$(jq -r '.bin.proton' "$proton/package.json")"
mkdir -p node_modules/.bin
ln -sfn "$proton/$bin" node_modules/.bin/proton
echo "linked: node_modules/.bin/proton -> $proton/$bin"
