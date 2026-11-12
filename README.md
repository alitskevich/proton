# Proton

Infrastructure utilities and resources.

## Purpose

Keep each shared utility in one home, so sibling projects stop copying it.

## Goals

- Share infrastructure utilities across the sibling projects
- Keep each utility in one home instead of a copy per project

## Imported code

Code a project imports rather than runs, addressed as `proton/<name>`. `proton` is private and unpublished, so a project gets it from the sibling checkout: add it to the project's `link-modules.sh` list, and never to `dependencies` — the name on npm belongs to someone else.

| Export | What |
| --- | --- |
| `proton/devops` | Dev-only tools an app mounts on localhost: the hot reload. See [devops/README.md](devops/README.md). |
| `proton/devops/local` | `isLocalHost`, `isLocalOrigin` — pure, safe in a dev server. |
| `proton/esbuild` | esbuild plugin: an `.xml` import becomes its pre-parsed component list (`bundler/`). |
| `proton/vite` | The same as a Vite plugin (`bundler/`). |

`npm run gates` checks them: typecheck, lint and test.

## ops

Shared scripts for the sibling projects in `~/Projects`. Call them from a project root as `../proton/ops/<name>`, and from a workspace package (`packages/<pkg>`, `apps/<app>`) as `../../../proton/ops/<name>`. Every script works on the current directory.

| Script | Purpose |
| --- | --- |
| `link-modules.sh <pkg>...` | Symlink sibling checkouts `../<pkg>` into `./node_modules` (`postinstall`). |
| `build.ts [--watch]` | esbuild bundle; options come from the `esbuild` block of `./package.json`. |
| `serve.ts` | esbuild dev server with watch; `PORT`, `HOST`, `PROXY_PORT` (live-reload proxy). |
| `reindex.ts <dirs> <indexFile> [--filter=<glob>]` | Generate a CML index module from `.xml` components. |
| `index-modules.ts [<dir,dir>]` | Generate `registry.ts` per module (default: `.`). |
| `generate-catalog.ts [<dir,dir>] [outFile]` | Generate `catalog.json` from `<Component>` signatures (defaults: `cml`, `catalog.json`). |
| `generate-shapes.ts <sourceDir> <outFile> [--watch]` | Generate a module of `<name>Shape` `as const` row lists from `<sourceDir>/<name>.json` vocabularies (`{ items }`). |
| `generate-forms.ts <sourceDir> <outFile> [--watch]` | Generate a `forms` module, typed by the `FormField` of the `types.ts` beside it, from `<sourceDir>/<name>.json` forms (`{ description?, fields }`; a field's `$comment` and `$off` become comments). |
| `index-docs.ts [dir] [--watch]` | Write `www/index.json`, the jsDelivr-shaped tree of the non-ignored files under `dir` (default `docs`) for a books site. |
| `upload.ts <file> [url] [token]` | POST a `{ store: rows[] }` JSON bundle in batches (`TARGET_URL`, `TOKEN`). |
| `download-sheets.ts <spreadsheetId> [outFile]` | Dump a Google Spreadsheet as `{ sheet: rows[] }` JSON (stdout, one file, or one per `{sheet}`); Application Default Credentials. |
| `bump-version.sh [file]` | Increment the cache-busting integer in `./www/version`. |
| `emulators.sh` | Start the Firebase emulators (functions, firestore, auth, storage). |

`utils/` holds the helpers these scripts share.

## configs

Shared base configs. Extend them by relative path, e.g. `"extends": "../proton/configs/tsconfig.json"`.

| File | Purpose |
| --- | --- |
| `tsconfig.json` | Strict ESNext + DOM, bundler resolution, no emit. Projects add `include`, `types` and their own options. |

## Setup

```bash
npm install
```

Installs `esbuild`, `google-auth-library` and the test tooling, and links `../arrmatura` and `../ultimus`. The TS scripts resolve their imports from `proton/node_modules`, not from the calling project.
