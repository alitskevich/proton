/**
 * `proton/hot` — the hot reload's client: `components` (`HotReloadService`) for an app to register, plus the
 * configuration contract. The server half (`server/`) is never imported from here; an app runs it with bun.
 */

import { HotReloadService } from "./HotReloadService";

export const components = [HotReloadService];

export * from "./config";
export { HotReloadService };
