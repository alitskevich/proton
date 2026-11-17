# Proton

Infrastructure utilities and resources.

## Purpose

Keep each shared utility in one home, so sibling projects stop copying it.

## Goals

- Share infrastructure utilities across the sibling projects
- Keep each utility in one home instead of a copy per project

## Imported code

Code a project imports rather than runs, addressed as `proton/<name>`. `proton` is private and unpublished, so a project lists the sibling checkout as a `file:` dependency — an app as `"proton": "file://../../libs/proton"`, a library in `libs/` as `"proton": "file://../proton"` — never a registry version: the name on npm belongs to someone else.

| Export | What |
| --- | --- |
| `proton/devops` | `LOCAL_HOSTNAMES`, `isLocalHost`, `isLocalOrigin` — pure, safe in a dev server. See [devops/README.md](devops/README.md). |
| `proton/hot` | The hot reload: `HotReloadService` and its bun server (`hot/server/main.ts`). See [hot/README.md](hot/README.md). |
| `proton/utils-files` | The file system: `node:fs`, `node:fs/promises`, `node:path` and the helpers on them (`nodeFiles`, `mapDirectoryFiles`, `readJsonFiles`, …). See [the Node.js boundary](#nodejs-boundary). |
| `proton/utils-node` | The rest of Node: processes (`runCommand`, …), network, http, crypto, os, url, readline, argv (`overlayLang`). See [the Node.js boundary](#nodejs-boundary). |
| `proton/esbuild` | esbuild plugin: an `.xml` import becomes its pre-parsed component list (`bundler/`, beside `getEsbuildOptions`, the base options of `build` and `serve`). |
| `proton/vite` | The same as a Vite plugin (`bundler/`). |

`npm run gates` checks them: typecheck, lint and test.

### Node.js boundary

`utils-files` and `utils-node` are the only door to Node.js built-ins for a project that keeps them out of its own code (almaster lints for it). Their rules:

- 🔒 Each imports Node directly, so neither depends on the other.
- 🔒 Export only what code outside them uses. When the last outside user goes, the export goes too.
- 🔒 One helper per file, named after it: `<name>.ts` exports exactly `<name>`.
- 🔒 Plain Node functions are re-exported from one file per Node module, in its owner, with no single-function re-export files: `fs.ts`, `fsPromises.ts`, `path.ts`, `childProcess.ts`, …
- 🔒 `index.ts` re-exports every file. Import from `proton/utils-files` or `proton/utils-node`.
- 🔒 All types and interfaces live in `types.ts`. Node's own types (`Dirent`, `IncomingMessage`, …) are re-exported from there too.
- 🔒 Every helper has a unit test, `<name>.test.ts`. `index.test.ts` proves every module file re-exports Node's own functions from a module its owner owns, and fails when a file breaks the rules above.
- 🔒 Relative imports end in `.ts` and type imports use `import type`, so plain Node (`.ts` scripts, `.mjs`) runs them with no build step.
- Missing Node function → add its name to that module's file in the owner. Missing helper → add `<name>.ts`, its test, and its line in `index.ts`.

## ops

Shared scripts for the sibling projects in `~/Projects`. An npm script calls one by name, as `proton <name> [args]` (`"build:css": "proton build-css --minify"`), from a project root and a workspace package alike. Every script works on the current directory.

`proton` is the `bin` of this package (`ops/cli.ts`): it runs `ops/<name>.ts` under Bun, or `ops/<name>.sh`, and passes signals and the exit code through. npm puts it in `node_modules/.bin` from the `file:` dependency, before `postinstall` runs, so an app's `postinstall` can be `proton link-modules`: that links every other library checkout.

| Script | Purpose |
| --- | --- |
| `link-modules.sh` | Symlink every library in `~/Projects/libs` into `./node_modules` (`postinstall`). |
| `build.ts [--watch]` | esbuild bundle; options come from the `esbuild` block of `./package.json`. |
| `build-css.ts [input] [output] [--watch] [--minify]` | Tailwind CSS build (defaults: `index.css`, `www/dist/index.css`); `-` flags pass through to the Tailwind CLI, which is proton's own dependency. |
| `hot.ts <dir> <port>` | The hot reload server (`hot/server/main.ts`); see [hot/README.md](hot/README.md). |
| `serve.ts` | esbuild dev server with watch; `PORT`, `HOST`, `FALLBACK`, `PROXY_PORT` (live-reload proxy), `PROXY` + `PROXY_PATHS` (send those paths to an app back end, live reload on). |
| `reindex.ts <dirs> <indexFile> [--filter=<glob>]` | Generate a CML index module from `.xml` components. |
| `index-modules.ts [<dir,dir>]` | Generate `registry.ts` per module (default: `.`). |
| `generate-catalog.ts [<dir,dir>] [outFile]` | Generate `catalog.json` from `<Component>` signatures (defaults: `cml`, `catalog.json`). |
| `reindex-jsdoc.ts` | Write `index.md`, the list of every export reachable from `./index.ts` with the first sentence of its JSDoc, grouped by `src/<dir>` module and sorted by title. Doc tags configure it: `@module <Title>` in each `src/<dir>/index.ts` (the rest of that block is the blurb), `@example <one line>` in `./index.ts` (the import line). |
| `check-fresh.ts <npm script> <file or glob>…` | Fail when running the npm script changes any of the files: the generated files were stale. The result stays in place, to be committed. |
| `generate-shapes.ts <sourceDir> <outFile> [--watch]` | Generate a module of `<name>Shape` `as const` row lists from `<sourceDir>/<name>.json` vocabularies (`{ items }`). |
| `generate-forms.ts <sourceDir> <outFile> [--watch]` | Generate a `forms` module, typed by the `FormField` of the `types.ts` beside it, from `<sourceDir>/<name>.json` forms (`{ description?, fields }`; a field's `$comment` and `$off` become comments). |
| `index-docs.ts [dir] [--watch]` | Write `www/index.json`, the jsDelivr-shaped tree of the non-ignored files under `dir` (default `docs`) for a books site. |
| `upload.ts <file> [url] [token]` | POST a `{ store: rows[] }` JSON bundle in batches (`TARGET_URL`, `TOKEN`). |
| `download-sheets.ts <spreadsheetId> [outFile]` | Dump a Google Spreadsheet as `{ sheet: rows[] }` JSON (stdout, one file, or one per `{sheet}`); Application Default Credentials. |
| `bump-version.sh [file]` | Increment the cache-busting integer in `./www/version`. |
| `emulators.sh` | Start the Firebase emulators on the ports of `./firebase.json`; `EMULATORS` (default functions,firestore,auth,storage), `EMULATOR_DATA` (keep data there between runs). |

The scripts share helpers from `utils-files`, `utils-node`, `bundler/` and `ultimus` (`jsonSource`); `ops/` holds scripts only.

## configs

Shared base configs. Extend them by relative path, e.g. `"extends": "../proton/configs/tsconfig.json"`.

| File | Purpose |
| --- | --- |
| `tsconfig.json` | Strict ESNext + DOM, bundler resolution, no emit. Projects add `include`, `types` and their own options. |

## Setup

```bash
npm install
```

Installs `esbuild`, `@tailwindcss/cli`, `google-auth-library` and the test tooling, and links `../arrmatura` and `../ultimus`. The TS scripts resolve their imports from `proton/node_modules`, not from the calling project.
