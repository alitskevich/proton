#!/usr/bin/env bash
#
# Usage: arrmatura-support release [patch|minor|major|<version>]   (default: patch)
#
# Releases the package in the current directory as a GitHub dependency: runs its
# `gates`, bumps `version` in package.json, commits, tags `v<version>` and pushes
# main with the tag. A consumer then depends on the tag:
#
#   "<name>": "github:<owner>/<repo>#semver:^<version>"

set -eu

die() { echo "❌ $*" >&2; exit 1; }

bump="${1:-patch}"
branch=$(git rev-parse --abbrev-ref HEAD)

[ -z "$(git status --porcelain)" ] || die "dirty tree — commit or stash first"
[ "$branch" = "main" ] || die "on '$branch' — release from main"
git fetch --quiet origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "main differs from origin/main — pull or push first"

npm run --if-present gates
npm version "$bump" -m "chore(release): %s" >/dev/null
tag=$(git describe --tags --exact-match HEAD)
git push --atomic origin main "$tag"

name=$(node -p 'require("./package.json").name')
repo=$(git remote get-url origin | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##')
echo "✅ Released $name $tag"
echo "   \"$name\": \"github:$repo#semver:^${tag#v}\""
