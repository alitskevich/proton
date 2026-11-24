/**
 * `proton google-login <scope>…` — signs in to Google once, through the Desktop-app OAuth client
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (`~/.keys/.env`), and prints
 * `GOOGLE_OAUTH='{clientId, clientSecret, refreshToken}'` to append to `~/.keys/.env`.
 * Re-running issues a new refresh token; the newest line in `~/.keys/.env` wins.
 */
import { requireKey } from "../utils-files/requireKey.ts";
import { loginGoogle } from "../utils-node/loginGoogle.ts";

const scopes = process.argv.slice(2);
if (scopes.length === 0) {
  console.error("Usage: proton google-login <scope>…");
  process.exit(1);
}

try {
  const clientId = requireKey("GOOGLE_CLIENT_ID", "the Desktop OAuth client");
  const clientSecret = requireKey("GOOGLE_CLIENT_SECRET", "the Desktop OAuth client");
  const credentials = await loginGoogle({
    clientId,
    clientSecret,
    scope: scopes.join(" "),
    account: "your Google account",
  });
  console.log(`GOOGLE_OAUTH='${JSON.stringify(credentials)}'`);
  console.log("append this to ~/.keys/.env");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
