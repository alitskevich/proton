# Proton

Infrastructure utilities and resources.

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
| `index-docs.ts [dir] [--watch]` | Write `www/index.json`, the jsDelivr-shaped tree of the non-ignored files under `dir` (default `docs`) for a books site. |
| `upload.ts <file> [url] [token]` | POST a `{ store: rows[] }` JSON bundle in batches (`TARGET_URL`, `TOKEN`). |
| `bump-version.sh [file]` | Increment the cache-busting integer in `./www/version`. |
| `emulators.sh` | Start the Firebase emulators (functions, firestore, auth, storage). |

`utils/` holds the helpers these scripts share.

## Setup

```bash
npm install
```

Installs `esbuild` and links `../ultimus`. The TS scripts resolve their imports from `proton/node_modules`, not from the calling project.
