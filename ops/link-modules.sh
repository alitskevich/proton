#!/usr/bin/env bash
#
# Usage: ../proton/ops/link-modules.sh <package>...
#
# Links sibling checkouts (../<package>, i.e. ~/Projects/<package>) into ./node_modules of the
# current directory, so the project builds and runs against library source: tsc, esbuild, vitest
# and Tailwind read each package's `exports` map from there. Run from the project root by
# `npm run link` / `postinstall`. Safe to re-run; a missing checkout is skipped, not an error.

set -eu

[ $# -gt 0 ] || { echo "usage: $0 <package>..." >&2; exit 1; }

mkdir -p node_modules

for pkg in "$@"; do
  if [ -d "../$pkg" ]; then
    # npm may have installed a published copy here. `ln -sfn` cannot replace a directory — it
    # would link *inside* it — so clear it first; an existing link is replaced in place.
    [ -L "node_modules/$pkg" ] || rm -rf "node_modules/$pkg"
    ln -sfn "../../$pkg" "node_modules/$pkg"
    echo "linked node_modules/$pkg -> ../../$pkg"
  else
    echo "skipped $pkg: no checkout at ../$pkg" >&2
  fi
done
