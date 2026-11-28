# Arrmatura Support

Infrastructure utilities and resources.

## Purpose

Keep each shared utility in one home, so sibling projects stop copying it.

## Goals

- Share infrastructure utilities across the sibling projects
- Keep each utility in one home instead of a copy per project

## Imported code

Code a project imports rather than runs, addressed as `arrmatura-support/<name>`. `arrmatura-support` is private and unpublished, so a project lists the sibling checkout as a `file:` dependency — an app as `"arrmatura-support": "file://../../libs/arrmatura-support"`, a library in `libs/` as `"arrmatura-support": "file://../arrmatura-support"` — never a registry version: it is not on npm. Outside the `~/Projects` checkout, a project depends on a release tag instead: `"arrmatura-support": "github:arrmatura/arrmatura-support#semver:^1.0.0"`. arrmatura-support imports `ultimus`, `arrmatura` and `arrmatura-host` but does not install them, so the project lists them itself.

| Export | What |
| --- | --- |
| `arrmatura-support/meta` | The types the code generated from `.meta` is checked against: `FormField`, one field of a form (`meta/types.ts`). See [the model](#the-model-meta). |

`npm run gates` checks them: typecheck, lint and test.

### Node.js boundary

arrmatura-support holds no door to Node since 2026-11-27. Two doors of [arrmatura-host](../arrmatura-host/README.md) own a part of it: [`arrmatura-host/files`](../arrmatura-host/README.md#the-files-door) the file system (`node:fs`, `node:fs/promises`, `node:path`), [`arrmatura-host/processes`](../arrmatura-host/README.md#the-processes-door) child processes (`node:child_process`). A project imports those modules only through the doors (almaster and alex lint for it); any other Node module (`node:os`, `node:url`, `node:http`, …) it imports directly. A helper only one project uses lives in that project.

- An export moves to another door → grep every project's `biome.json` `noRestrictedImports` message and its CLAUDE.md boundary heading (and links to its anchor): they still name the old door, and nothing fails.

## ops

Shared scripts for the sibling projects in `~/Projects`. An npm script calls one by name, as `arrmatura-support <name> [args]` (`"codegen:cml-catalog": "arrmatura-support generate-catalog cml"`), from a project root and a workspace package alike. Every script works on the current directory.

`arrmatura-support` is the `bin` of this package (`bin/index.ts`): it runs `ops/<name>.ts` under Bun, or `ops/<name>.sh`, and passes signals and the exit code through. npm puts it in `node_modules/.bin` from the `file:` dependency, before `postinstall` runs, so an app's `postinstall` can be `arrmatura-support link-modules`: that links the library checkouts the project lists in its `dependencies`/`devDependencies`/`peerDependencies`.

- A library gains a `bin` → run `npm run link` in every project that lists it: `npm install` skips the `.bin` entry of a package its lockfile already links, so only `link-modules` adds the command.
- A project imports a library it does not list → it builds only on a stale link: the next `npm install` prunes it, and the build fails with `Could not resolve`. `check-deps` catches it.
- A library is renamed or gains a dependency → run `npm install` in the `libs/` checkouts first, then in the apps: npm runs each linked library's `postinstall` in that library's folder, with its own `.bin`, and fails with `command not found` there.
- A bin is renamed → delete each project's `node_modules/.bin/<old name>`: npm leaves the old link dangling.

| Script | Purpose |
| --- | --- |
| `link-modules.sh` | Symlink the libraries of `~/Projects/libs` named in the project's `dependencies`/`devDependencies`/`peerDependencies` into `./node_modules`, and their `bin` commands into `./node_modules/.bin` (`postinstall`). Runs `clone-modules.sh` first. |
| `clone-modules.sh` | Clone the libraries missing from `~/Projects/libs` (hardcoded list of repos). |
| `reindex.ts <dirs> <indexFile> [--filter=<glob>] [--watch]` | Generate a CML index module from `.xml` components; `--watch` reindexes when an `.xml` is added, removed or renamed. |
| `index-modules.ts [<dir,dir>]` | Generate `registry.ts` per module (default: `.`). |
| `generate-catalog.ts [<dir,dir>] [outFile] [--extended]` | Generate `catalog.json` from `<Component>` signatures (defaults: `cml`, `catalog.json`); `--extended` adds each one's `<Prop>`s and `<State>`s as `properties`, told apart by `kind`. |
| `check-fresh.ts <npm script> <file or glob>…` | Fail when running the npm script changes any of the files: the generated files were stale. The result stays in place, to be committed. |
| `check-deps.ts` | Fail when a package under `.` imports a library of `~/Projects/libs` (or runs one from `node_modules/<lib>/` in a script) that neither it nor a package around it lists: it builds only on a stale link. `check:deps` in each project's `gates`. |
| `generate-meta.ts <outDir> [--meta=<dir>] [--no-zod] [--overlay=<lang>] [--watch]` | Generate a project's model code from `.meta` (default) into `outDir`. See [the model](#the-model-meta). |
| `index-docs.ts [dir] [--watch]` | Write `www/index.json`, the jsDelivr-shaped tree of the non-ignored files under `dir` (default `docs`) for a books site. |
| `sitemap.ts <siteUrl> [dir]` | Write `www/sitemap.xml` of a books site: one `<url>` per markdown page of the `index-docs` tree, `<lastmod>` its last commit date. |
| `upload.ts <file> [url] [token]` | POST a `{ store: rows[] }` JSON bundle as `upsertBatch` actions of 500 rows (`TARGET_URL`, `TOKEN`); a failed batch stops the upload and exits 1. |
| `release.sh [patch\|minor\|major\|<version>]` | Release the current package as a GitHub dependency: from a clean `main` in step with `origin`, run `gates`, bump `version` (default `patch`), commit, tag `v<version>`, push both. arrmatura-support's own `npm run release` runs it. |

The scripts share helpers from `arrmatura-host/files`, `meta/` and `ultimus` (`isRecord`, `jsonSource`, `messageOf`, `stringSplit`), and parse their flags with `parseArgs` of `node:util`, so an unknown flag fails; `ops/` holds scripts and their tests.

The esbuild bundle and dev server, `build` and `serve`, are the `arrmatura-web` bin since 2026-11-28, beside its `.xml` plugins: see [its dev tools](../arrmatura-web/README.md#dev-tools). The Tailwind build is each project's own script since the same day, `"build:css": "tailwindcss -i index.css -o www/dist/index.css"`, with `@tailwindcss/cli` in its `devDependencies`: `npx @tailwindcss/cli` fails with `command not found` wherever a linked library brings the package into the tree without its bin.

## The model (`.meta`)

Every project keeps its model as data in `.meta/` and generates its code with one command, `arrmatura-support generate-meta <outDir>`: an npm script `codegen:meta`, `start:meta` its `-- --watch`, and `check:fresh` (`arrmatura-support check-fresh codegen:meta <outDir files>`) first in `gates`. The generators live in `meta/`, one per module, their shared helpers in `meta/impl/` (the header and write, comment lines, the `{ items }` check); `meta/generateMeta.ts` runs those whose source exists. A malformed source file throws, naming the file.

| Source | Holds | Module in `outDir` | Read as |
| --- | --- | --- | --- |
| `enums/<name>.json` | A vocabulary: `{ $comment?, items: [{ id, … }] }` | `shapes.ts`: `<name>Shape` rows `as const`; with zod `schema.ts`: `Z<Name>` / `T<Name>` | `R.enums.<name>` (the `Shape` suffix dropped, `objectMapKeys`) |
| `forms/<name>.json` | A `Forma` form or table columns: `{ description?, extends?, pick?, partial?, fields }` | `forms.ts`: `forms.<name>`, checked against `FormField` of `arrmatura-support/meta` | `R.forms.<name>` |
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

Shared base configs. Extend them by relative path, e.g. `"extends": "../arrmatura-support/configs/tsconfig.json"`.

| File | Purpose |
| --- | --- |
| `tsconfig.json` | Strict ESNext + DOM, bundler resolution, no emit. Projects add `include`, `types` and their own options. |

## Setup

```bash
npm install
```

Installs the test tooling, and links `../arrmatura`, `../arrmatura-host` and `../ultimus`. The TS scripts resolve their imports from `arrmatura-support/node_modules`, not from the calling project.
