/**
 * The configuration contract of the hot reload: every constant below is written here and nowhere else.
 *
 * The port is the app's: the server takes it as an argument, `HotReloadService` as its `port` prop.
 */

export const HOT_HOST = "127.0.0.1";
export const HOT_PATH = "/hot";
/**
 * The debounce window: every write restarts it, and the batch is reported once it passes with no write.
 * Long enough for a whole rebuild — the CSS watcher and the bundler write seconds apart — to relaunch the page once.
 */
export const HOT_SETTLE_MS = 2_000;
