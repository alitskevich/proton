/** `--overlay=<lang>` from `process.argv`: the language whose overlay a generator writes, else the base. */
export const overlayLang = () =>
  process.argv.find((a) => a.startsWith("--overlay="))?.slice("--overlay=".length) || undefined;
