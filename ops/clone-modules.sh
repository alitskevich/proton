#!/usr/bin/env bash
#
# Usage: proton clone-modules
#
# Clones the library checkouts missing from the libs folder (the one holding proton, ~/Projects/libs).
# The list is hardcoded: add a line when a new library appears. Existing checkouts are left untouched.

set -eu

libs="$(dirname "$(cd "$(dirname "$0")/.." && pwd)")"

repos="
arrmatura/arrmatura
arrmatura/arrmatura-books
arrmatura/arrmatura-brain
arrmatura/arrmatura-canvas
arrmatura/arrmatura-host
arrmatura/arrmatura-markdown
arrmatura/arrmatura-vibe
arrmatura/arrmatura-web
arrmatura/ultimus
alitskevich/firebasis
alitskevich/proton
"

for repo in $repos; do
  dest="$libs/${repo#*/}"
  if [ -d "$dest" ]; then
    echo "present: $dest"
  else
    git clone "https://github.com/$repo.git" "$dest"
    echo "cloned: $dest"
  fi
done
