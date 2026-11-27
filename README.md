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
| `proton/utils-files` | The file system: `node:fs`, `node:fs/promises`, `node:path` and the helpers on them (`nodeFiles`, `mapDirectoryFiles`, `readJsonFiles`, …). A re-export of [`arrmatura-host/files`](../arrmatura-host/README.md#the-files-door), which owns the code. See [the Node.js boundary](#nodejs-boundary). |
| `proton/utils-node` | The rest of Node: processes (`runCommand`, …), network, http, crypto, os, url, readline, argv (`overlayLang`). Its `Processes` and the types of it are a re-export of [`arrmatura-host/processes`](../arrmatura-host/README.md#the-processes-door). See [the Node.js boundary](#nodejs-boundary). |
| `proton/meta` | The types the code generated from `.meta` is checked against: `FormField`, one field of a form (`meta/types.ts`). See [the model](#the-model-meta). |
| `proton/esbuild` | esbuild plugin: an `.xml` import becomes its pre-parsed component list (`bundler/`, beside `getEsbuildOptions`, the base options of `build` and `serve`). |
| `proton/getEsbuildOptions` | The base options of `build` and `serve` (browser ESM bundle, with the `proton/esbuild` plugin), for a script that bundles by itself. |
| `proton/vite` | The same as a Vite plugin (`bundler/`). |

`npm run gates` checks them: typecheck, lint and test.

### Node.js boundary

`utils-files` and `utils-node` are the only door to Node.js built-ins for a project that keeps them out of its own code (almaster lints for it).

`utils-files` is one line: it re-exports `arrmatura-host/files`, the sibling library that owns the file system since 2026-11-25. Its code, tests and rules are [there](../arrmatura-host/README.md#the-files-door); a missing file-system function or helper is added there. In the same way `utils-node` re-exports `Processes` and the types `IProcess` and `SpawnSpec` from `arrmatura-host/processes`. Both entries import Node only and arrmatura-host imports nothing of proton, so neither re-export makes a cycle.

The rules of `utils-node`:

- 🔒 It imports Node directly, never `utils-files`. The one exception is `Processes.ts`, a re-export.
- 🔒 Export only what code outside it uses. When the last outside user goes, the export goes too.
- 🔒 One helper per file, named after it: `<name>.ts` exports exactly `<name>`.
- 🔒 Plain Node functions are re-exported from one file per Node module, with no single-function re-export files: `childProcess.ts`, `os.ts`, `http.ts`, …
- 🔒 `index.ts` re-exports every file. Import from `proton/utils-node`.
- 🔒 All types and interfaces live in `types.ts`. Node's own types (`IncomingMessage`, `ServerResponse`, …) are re-exported from there too.
- 🔒 Every helper has a unit test, `<name>.test.ts` (the test of `Processes` sits with its code, in arrmatura-host). `index.test.ts` proves every module file re-exports Node's own functions from a module `utils-node` owns (any but `node:fs`, `node:fs/promises`, `node:path`), and fails when a file breaks the rules above.
- 🔒 Relative imports end in `.ts` and type imports use `import type`, so plain Node (`.ts` scripts, `.mjs`) runs them with no build step.
- Missing Node function → add its name to that module's file. Missing helper → add `<name>.ts`, its test, and its line in `index.ts`.

## ops

Shared scripts for the sibling projects in `~/Projects`. An npm script calls one by name, as `proton <name> [args]` (`"build:css": "proton build-css --minify"`), from a project root and a workspace package alike. Every script works on the current directory.

`proton` is the `bin` of this package (`bin/index.ts`): it runs `ops/<name>.ts` under Bun, or `ops/<name>.sh`, and passes signals and the exit code through. npm puts it in `node_modules/.bin` from the `file:` dependency, before `postinstall` runs, so an app's `postinstall` can be `proton link-modules`: that links the library checkouts the project lists in its `dependencies`/`devDependencies`.

| Script | Purpose |
| --- | --- |
| `link-modules.sh` | Symlink the libraries of `~/Projects/libs` named in the project's `dependencies`/`devDependencies` into `./node_modules` (`postinstall`). Runs `clone-modules.sh` first. |
| `clone-modules.sh` | Clone the libraries missing from `~/Projects/libs` (hardcoded list of repos). |
| `build.ts [--watch]` | esbuild bundle; options come from the `esbuild` block of `./package.json`. |
| `build-css.ts [input] [output] [--watch] [--minify]` | Tailwind CSS build (defaults: `index.css`, `www/dist/index.css`); `-` flags pass through to the Tailwind CLI, which is proton's own dependency. |
| `serve.ts [--hot]` | esbuild dev server with watch; `--hot` serves the hot reload stream at `/__hot` ([`arrmatura-web/hot`](../arrmatura-web/modules/hot/README.md)); `PORT`, `HOST`, `FALLBACK`, `PROXY_PORT` (live-reload proxy), `PROXY` + `PROXY_PATHS` (send those paths to an app back end, live reload on). |
| `reindex.ts <dirs> <indexFile> [--filter=<glob>]` | Generate a CML index module from `.xml` components. |
| `index-modules.ts [<dir,dir>]` | Generate `registry.ts` per module (default: `.`). |
| `generate-catalog.ts [<dir,dir>] [outFile] [--extended]` | Generate `catalog.json` from `<Component>` signatures (defaults: `cml`, `catalog.json`); `--extended` adds each one's `<Prop>`s and `<State>`s as `properties`, told apart by `kind`. |
| `check-fresh.ts <npm script> <file or glob>…` | Fail when running the npm script changes any of the files: the generated files were stale. The result stays in place, to be committed. |
| `generate-meta.ts <outDir> [--meta=<dir>] [--no-zod] [--overlay=<lang>] [--watch]` | Generate a project's model code from `.meta` (default) into `outDir`. See [the model](#the-model-meta). |
| `index-docs.ts [dir] [--watch]` | Write `www/index.json`, the jsDelivr-shaped tree of the non-ignored files under `dir` (default `docs`) for a books site. |
| `upload.ts <file> [url] [token]` | POST a `{ store: rows[] }` JSON bundle in batches (`TARGET_URL`, `TOKEN`). |
| `download-sheets.ts <spreadsheetId> [outFile]` | Dump a Google Spreadsheet as `{ sheet: rows[] }` JSON (stdout, one file, or one per `{sheet}`); Application Default Credentials. |
| `google-login.ts <scope>…` | Sign in to Google once through the Desktop OAuth client `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (`~/.keys/.env`) and print `GOOGLE_OAUTH='{clientId, clientSecret, refreshToken}'` to append there (`utils-node/loginGoogle`). |
| `release.sh [patch\|minor\|major\|<version>]` | Release the current package as a GitHub dependency: from a clean `main` in step with `origin`, run `gates`, bump `version` (default `patch`), commit, tag `v<version>`, push both. proton's own `npm run release` runs it. |
| `bump-version.sh [file]` | Increment the cache-busting integer in `./www/version`. |
| `emulators.sh` | Start the Firebase emulators on the ports of `./firebase.json`; `EMULATORS` (default functions,firestore,auth,storage), `EMULATOR_DATA` (keep data there between runs). |

The scripts share helpers from `utils-files`, `utils-node`, `bundler/`, `meta/` and `ultimus` (`jsonSource`); `ops/` holds scripts only.

## The model (`.meta`)

Every project keeps its model as data in `.meta/` and generates its code with one command, `proton generate-meta <outDir>`: an npm script `codegen:meta`, `start:meta` its `-- --watch`, and `check:fresh` (`proton check-fresh codegen:meta <outDir files>`) first in `gates`. The generators live in `meta/`, one per module; `meta/generateMeta.ts` runs those whose source exists.

| Source | Holds | Module in `outDir` | Read as |
| --- | --- | --- | --- |
| `enums/<name>.json` | A vocabulary: `{ $comment?, items: [{ id, … }] }` | `shapes.ts`: `<name>Shape` rows `as const`; with zod `schema.ts`: `Z<Name>` / `T<Name>` | `R.enums.<name>` (the `Shape` suffix dropped, `objectMapKeys`) |
| `forms/<name>.json` | A `Forma` form or table columns: `{ description?, extends?, pick?, partial?, fields }` | `forms.ts`: `forms.<name>`, checked against `FormField` of `proton/meta` | `R.forms.<name>` |
| `strings/<area>.json` | UI texts: an object, nested groups allowed, no arrays | `strings.ts`: `export const <area>` | `R.<area>.<key>` |
| `structs/<name>.json`, `primitives.json`, `functions.json` | Data shapes: `{ description?, loose?, strict?, extends?, fields }`; custom primitives; the functions a `refine` names | with zod `structs.ts`: `Z<Name>` / `T<Name>`, dependencies first | Zod schemas, types |

A struct field or primitive spec is a string by default; `type` is `boolean`/`number`/`int`/`date`/`isoDate`/`unknown`/`email`/`url`, `primitive`/`object`/`enum` + `typeSpec`, `union` + `typeSpec: "a|b"`, or one `const`; `isMulti` (`minItems`, `maxItems`), `isMap`, `nullable`, `min`/`max`/`exclusiveMin`/`exclusiveMax`/`pattern`/`message`, `protocol` (a `url`'s scheme), `required: true`, `default`, `fallback` (`.catch`), `hint` (`.describe`). `refine` is a `|` pipe: `trim`/`toLowerCase`/`toUpperCase` first, then primitive or struct ids (`.pipe`) and `functions.json` functions (`{ items: [{ id, from }] }`, `.transform`). A struct is `loose`/`strict`, or `extends` a parent (`pick`, `partial`). The full spec: `Spec` in `meta/structs.ts`.

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

Installs `esbuild`, `@tailwindcss/cli`, `google-auth-library` and the test tooling, and links `../arrmatura`, `../arrmatura-host` and `../ultimus`. The TS scripts resolve their imports from `proton/node_modules`, not from the calling project.
