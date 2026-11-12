#!/usr/bin/env bash
#
# Usage: <path-to>/proton/ops/link-modules.sh <package>...
#
# Links checkouts under the projects root (the folder holding proton: <root>/<package> or one
# group down, <root>/<group>/<package>, e.g. ~/Projects/libs/arrmatura) into ./node_modules of the
# current directory, so the project builds and runs against library source: tsc, esbuild, vitest
# and Tailwind read each package's `exports` map from there. Run from the project root by
# `npm run link` / `postinstall`. Safe to re-run; a missing checkout is skipped, not an error.

set -eu

[ $# -gt 0 ] || { echo "usage: $0 <package>..." >&2; exit 1; }

root="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p node_modules

for pkg in "$@"; do
  src=""
  for dir in "$root/$pkg" "$root"/*/"$pkg"; do
    [ -d "$dir" ] && { src="$dir"; break; }
  done
  if [ -n "$src" ]; then
    # npm may have installed a published copy here. `ln -sfn` cannot replace a directory — it
    # would link *inside* it — so clear it first; an existing link is replaced in place.
    [ -L "node_modules/$pkg" ] || rm -rf "node_modules/$pkg"
    ln -sfn "$src" "node_modules/$pkg"
    echo "linked node_modules/$pkg -> $src"
  else
    echo "skipped $pkg: no checkout of it under $root" >&2
  fi
done
