import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import type { GoogleCredentials, GoogleLogin } from "./types.ts";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const openInBrowser = (url: string) => {
  spawnSync("open", [url]);
};

/** Opens the consent page and waits for Google to send the browser back to a loopback port with `?code=`. */
function authorize(login: GoogleLogin): Promise<{ code: string; redirectUri: string }> {
  const { clientId, scope, account, open = openInBrowser } = login;
  return new Promise((resolve, reject) => {
    let redirectUri = "";
    const server = createServer((request, response) => {
      const params = new URL(request.url ?? "/", redirectUri).searchParams;
      const code = params.get("code");
      const error = params.get("error");
      if (!code && !error) {
        response.writeHead(404).end();
        return;
      }
      response.end(code ? "Signed in. Close this tab." : `Not signed in: ${error}`);
      server.close();
      if (code) resolve({ code, redirectUri });
      else reject(new Error(`consent refused: ${error}`));
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("no port"));
        return;
      }
      redirectUri = `http://127.0.0.1:${address.port}`;
      const query = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope,
        access_type: "offline",
        prompt: "consent",
      });
      const url = `${AUTH_URL}?${query}`;
      console.log(`Sign in with ${account}:\n${url}`);
      open(url);
    });
  });
}

/**
 * Signs `account` in to Google once, in the browser, through a Desktop-app OAuth client, and returns that client
 * with a refresh token for `scope` (space-separated). Each run issues a new refresh token.
 */
export async function loginGoogle(login: GoogleLogin): Promise<GoogleCredentials> {
  const { clientId, clientSecret, fetch = globalThis.fetch } = login;
  const { code, redirectUri } = await authorize(login);
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch(TOKEN_URL, { method: "POST", body });
  const reply: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`token exchange: ${response.status} ${JSON.stringify(reply)}`);
  const refreshToken = (reply as { refresh_token?: unknown } | undefined)?.refresh_token;
  if (typeof refreshToken !== "string") throw new Error("token exchange: the reply has no refresh_token");
  return { clientId, clientSecret, refreshToken };
}
