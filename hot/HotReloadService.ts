/**
 * HotReloadService
 * Follows the hot server's change stream (`server/main.ts`) and brings the page up to date with
 * the watched folder without reloading it: a changed stylesheet is swapped in place, so the app keeps its
 * state; a changed bundle relaunches the app — the root is disposed and the bundle imported afresh,
 * which launches it again. Localhost only: elsewhere it does nothing.
 *
 * `port` is the hot server's, the one the app runs it on.
 */

import { Component, type IEntitronRoot } from "arrmatura";
import { isLocalHost } from "../devops";
import { HOT_HOST, HOT_PATH } from "./config";

/** True when `href` is a file of `origin` whose name is one of `files`; the query does not count. */
export function isChanged(href: string, files: string[], origin: string): boolean {
  const url = new URL(href);
  return url.origin === origin && files.some((name) => url.pathname.endsWith(`/${name}`));
}

/** `href` with its `v` query parameter set: a new cache key, so the browser fetches the file again. */
export function withVersion(href: string, version: number): string {
  const url = new URL(href);
  url.searchParams.set("v", String(version));
  return url.href;
}

/** Loads `href` into a copy of `link` and drops the old one once it applies, so the page never goes unstyled. */
function swapSheet(link: HTMLLinkElement, href: string) {
  const next = link.cloneNode() as HTMLLinkElement;
  next.href = href;
  next.onload = () => link.remove();
  link.after(next);
}

export class HotReloadService extends Component {
  declare port: number;

  __init() {
    if (!isLocalHost(window.location.hostname)) return;
    const source = new EventSource(`http://${HOT_HOST}:${this.port}${HOT_PATH}`);
    source.onmessage = (event) => this.apply(JSON.parse(event.data));
    this.defer(() => source.close());
  }

  /** Brings the page up to date with one batch of changed file names of the watched folder. */
  async apply(files: string[]) {
    const { origin } = window.location;
    const version = Date.now();
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
      if (isChanged(link.href, files, origin)) swapSheet(link, withVersion(link.href, version));
    });
    // This module is bundled, so its URL is the bundle's own.
    if (!isChanged(import.meta.url, files, origin)) return;
    // The top of the tree is the launched root, typed as a plain instance.
    (this.$$.root as IEntitronRoot).done();
    // A bundle that fails to launch leaves no service to hear the next change: reload the page instead.
    await import(withVersion(import.meta.url, version)).catch(() => window.location.reload());
  }
}
