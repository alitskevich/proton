/**
 * `proton/devops` — dev-only tools an app mounts on localhost. Not part of the `arrmatura-web` `modules`
 * bundle: an app registers `components` itself. The server halves (`hot/server/`) are never
 * imported from here; an app runs them with bun.
 */

import { HotReloadService } from "./hot/HotReloadService";

export const components = [HotReloadService];

export * from "./local";
