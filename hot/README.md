# hot

The hot reload, addressed as `proton/hot`. Not part of the `arrmatura-web` `modules` bundle: an app spreads `components` into its own registry. A rebuild relaunches the app in place; the page is never reloaded. Off localhost it does nothing.

| Export | What |
| --- | --- |
| `proton/hot` | `components` (`HotReloadService`), `HotReloadService`, and the `config` constants (`HOT_HOST`, `HOT_PATH`, `HOT_SETTLE_MS`) |

- **Server** — `bun ../proton/hot/server/main.ts <dir> <port>` watches `dir` (the bundler's output) and streams each batch of changed files, debounced by `HOT_SETTLE_MS` (2 s: every write restarts the wait), over SSE on `127.0.0.1:<port>/hot`. Content-hashed, so a rewrite with the same bytes is no change; source maps are left out; a non-local `Origin` gets `403`.
- **Client** — `<HotReloadService port="{…}" />`, mounted once, follows that stream: a changed stylesheet is swapped in place, keeping the app's state; a changed bundle disposes the root and imports the bundle afresh under a `?v=` key, which launches it again. A bundle that fails to launch falls back to a page reload.

`port` must be the same number on both sides; keep it in one place of the app (bombarbia reads `hotPort` from its `project.json`).
