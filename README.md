# Proton

Infrastructure utilities and resources.

## Purpose

Keep each shared utility in one home, so sibling projects stop copying it.

## Goals

- Share infrastructure utilities across the sibling projects
- Keep each utility in one home instead of a copy per project

## Imported code

Code a project imports rather than runs, addressed as `proton/<name>`. `proton` is private and unpublished, so a project lists the sibling checkout as a `file:` dependency — an app as `"proton": "file://../../libs/proton"`, a library in `libs/` as `"proton": "file://../proton"` — never a registry version: the name on npm belongs to someone else. Outside the `~/Projects` checkout, a project depends on a release tag instead: `"proton": "github:alitskevich/proton#semver:^1.0.0"`. proton imports `ultimus`, `arrmatura` and `arrmatura-host` but does not install them, so the project lists them itself.

| Export | What |
| --- | --- |
| `proton/meta` | The types the code generated from `.meta` is checked against: `FormField`, one field of a form (`meta/types.ts`). See [the model](#the-model-meta). |
| `proton/esbuild` | esbuild plugin: an `.xml` import becomes its pre-parsed component list (`bundler/`, beside `getEsbuildOptions`, the base options of `build` and `serve`). |
| `proton/getEsbuildOptions` | The base options of `build` and `serve` (browser ESM bundle, with the `proton/esbuild` plugin), for a script that bundles by itself. |
| `proton/vite` | The same as a Vite plugin (`bundler/`). |

`npm run gates` checks them: typecheck, lint and test.

### Node.js boundary

proton holds no door to Node since 2026-11-27. Two doors of [arrmatura-host](../arrmatura-host/README.md) own a part of it: [`arrmatura-host/files`](../arrmatura-host/README.md#the-files-door) the file system (`node:fs`, `node:fs/promises`, `node:path`), [`arrmatura-host/processes`](../arrmatura-host/README.md#the-processes-door) child processes (`node:child_process`). A project imports those modules only through the doors (almaster and alex lint for it); any other Node module (`node:os`, `node:url`, `node:http`, …) it imports directly. A helper only one project uses lives in that project.

- An export moves to another door → grep every project's `biome.json` `noRestrictedImports` message and its CLAUDE.md boundary heading (and links to its anchor): they still name the old door, and nothing fails.

## ops

Shared scripts for the sibling projects in `~/Projects`. An npm script calls one by name, as `proton <name> [args]` (`"build:css": "proton build-css --minify"`), from a project root and a workspace package alike. Every script works on the current directory.

`proton` is the `bin` of this package (`bin/index.ts`): it runs `ops/<name>.ts` under Bun, or `ops/<name>.sh`, and passes signals and the exit code through. npm puts it in `node_modules/.bin` from the `file:` dependency, before `postinstall` runs, so an app's `postinstall` can be `proton link-modules`: that links the library checkouts the project lists in its `dependencies`/`devDependencies`/`peerDependencies`.

| Script | Purpose |
| --- | --- |
| `link-modules.sh` | Symlink the libraries of `~/Projects/libs` named in the project's `dependencies`/`devDependencies`/`peerDependencies` into `./node_modules` (`postinstall`). Runs `clone-modules.sh` first. |
| `clone-modules.sh` | Clone the libraries missing from `~/Projects/libs` (hardcoded list of repos). |
| `build.ts [--watch]` | esbuild bundle; options come from the `esbuild` block of `./package.json` (`servedir` left out). |
| `build-css.ts [input] [output] [--watch] [--minify]` | Tailwind CSS build (defaults: `index.css`, `www/dist/index.css`); `-` flags pass through to the Tailwind CLI, which is proton's own dependency. |
| `serve.ts [--hot]` | esbuild dev server with watch, options from the same `esbuild` block; `--hot` serves the hot reload stream at `/__hot` ([`arrmatura-web/hot`](../arrmatura-web/modules/hot/README.md)); `PORT`, `HOST`, `WWW` (servedir when the block names none, default `./www`), `FALLBACK`, `PROXY_PORT` (live-reload proxy), `PROXY` + `PROXY_PATHS` (send those paths to an app back end, live reload on). |
| `reindex.ts <dirs> <indexFile> [--filter=<glob>] [--watch]` | Generate a CML index module from `.xml` components; `--watch` reindexes when an `.xml` is added, removed or renamed. |
| `index-modules.ts [<dir,dir>]` | Generate `registry.ts` per module (default: `.`). |
| `generate-catalog.ts [<dir,dir>] [outFile] [--extended]` | Generate `catalog.json` from `<Component>` signatures (defaults: `cml`, `catalog.json`); `--extended` adds each one's `<Prop>`s and `<State>`s as `properties`, told apart by `kind`. |
| `check-fresh.ts <npm script> <file or glob>…` | Fail when running the npm script changes any of the files: the generated files were stale. The result stays in place, to be committed. |
| `generate-meta.ts <outDir> [--meta=<dir>] [--no-zod] [--overlay=<lang>] [--watch]` | Generate a project's model code from `.meta` (default) into `outDir`. See [the model](#the-model-meta). |
| `index-docs.ts [dir] [--watch]` | Write `www/index.json`, the jsDelivr-shaped tree of the non-ignored files under `dir` (default `docs`) for a books site. |
| `sitemap.ts <siteUrl> [dir]` | Write `www/sitemap.xml` of a books site: one `<url>` per markdown page of the `index-docs` tree, `<lastmod>` its last commit date. |
| `upload.ts <file> [url] [token]` | POST a `{ store: rows[] }` JSON bundle as `upsertBatch` actions of 500 rows (`TARGET_URL`, `TOKEN`); a failed batch stops the upload and exits 1. |
| `release.sh [patch\|minor\|major\|<version>]` | Release the current package as a GitHub dependency: from a clean `main` in step with `origin`, run `gates`, bump `version` (default `patch`), commit, tag `v<version>`, push both. proton's own `npm run release` runs it. |
| `bump-version.sh [file]` | Increment the cache-busting integer in `./www/version`. |
| `emulators.sh` | Start the Firebase emulators on the ports of `./firebase.json`; `EMULATORS` (default functions,firestore,auth,storage), `EMULATOR_DATA` (keep data there between runs). |

The scripts share helpers from `arrmatura-host/files`, `bundler/`, `meta/` and `ultimus` (`jsonSource`, `stringSplit`), and parse their flags with `parseArgs` of `node:util`, so an unknown flag fails; `ops/` holds scripts, their tests and `consts.ts`.

## The model (`.meta`)

Every project keeps its model as data in `.meta/` and generates its code with one command, `proton generate-meta <outDir>`: an npm script `codegen:meta`, `start:meta` its `-- --watch`, and `check:fresh` (`proton check-fresh codegen:meta <outDir files>`) first in `gates`. The generators live in `meta/`, one per module, their shared helpers in `meta/impl/` (the header and write, comment lines, the `{ items }` check); `meta/generateMeta.ts` runs those whose source exists. A malformed source file throws, naming the file.

| Source | Holds | Module in `outDir` | Read as |
| --- | --- | --- | --- |
| `enums/<name>.json` | A vocabulary: `{ $comment?, items: [{ id, … }] }` | `shapes.ts`: `<name>Shape` rows `as const`; with zod `schema.ts`: `Z<Name>` / `T<Name>` | `R.enums.<name>` (the `Shape` suffix dropped, `objectMapKeys`) |
| `forms/<name>.json` | A `Forma` form or table columns: `{ description?, extends?, pick?, partial?, fields }` | `forms.ts`: `forms.<name>`, checked against `FormField` of `proton/meta` | `R.forms.<name>` |
| `strings/<area>.json` | UI texts: an object, nested groups allowed, no arrays | `strings.ts`: `export const <area>` | `R.<area>.<key>` |
| `structs/<name>.json`, `primitives.json`, `functions.json` | Data shapes: `{ description?, loose?, strict?, extends?, fields }`; custom primitives; the functions a `refine` names | with zod `structs.ts`: `Z<Name>` / `T<Name>`, dependencies first | Zod schemas, types |

A struct field or primitive spec is a string by default; `type` is `boolean`/`number`/`int`/`date`/`isoDate`/`unknown`/`email`/`url`, `primitive`/`object`/`enum` + `typeSpec`, `union` + `typeSpec: "a|b"`, or one `const`; `isMulti` (`minItems`, `maxItems`), `isMap`, `nullable`, `min`/`max`/`exclusiveMin`/`exclusiveMax`/`pattern`/`message`, `protocol` (a `url`'s scheme), `required` (`true`; `false` is the default), `default`, `fallback` (`.catch`), `hint` (`.describe`). `refine` is a `|` pipe: `trim`/`toLowerCase`/`toUpperCase` first, then primitive or struct ids (`.pipe`) and `functions.json` functions (`{ items: [{ id, from }] }`, `.transform`). A struct is `loose`/`strict`, or `extends` a parent (`pick`, `partial`). The full spec: `Spec` in `meta/structs.ts`.

| Flag | Does |
| --- | --- |
| `--meta=<dir>` | The model folder, when it is not `./.meta` (a workspace package: `--meta=../../.meta`). |
| `--no-zod` | Skips `schema.ts` and `structs.ts`, for a project without `zod`. |
| `--overlay=<lang>` | Writes that language's overlay of `shapes`, `forms` and `strings` as `<lang>.<module>.ts`: only the `<key>:<lang>` translations, rows matched by `id`. |
| `--watch` | Regenerates on every `.json` change under the model folder; a broken file is reported and the watch goes on. |

How a project wires and edits it, and the gotchas: the `arrmatura` skill's [metadata.md](../arrmatura-web/skills/arrmatura/docs/metadata.md).

## configs

Shared base configs. Extend them by relative path, e.g. `"extends": "../proton/configs/tsconfig.json"`.

| File | Purpose |
| --- | --- |
| `tsconfig.json` | Strict ESNext + DOM, bundler resolution, no emit. Projects add `include`, `types` and their own options. |

## Setup

```bash
npm install
```

Installs `esbuild`, `@tailwindcss/cli` and the test tooling, and links `../arrmatura`, `../arrmatura-host` and `../ultimus`. The TS scripts resolve their imports from `proton/node_modules`, not from the calling project.
