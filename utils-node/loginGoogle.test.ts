import { describe, expect, it } from "bun:test";
import { loginGoogle } from "./loginGoogle.ts";

/** The browser: follows the consent page's redirect back with `query`. */
const browser = (query: string) => (url: string) => {
  const redirectUri = new URL(url).searchParams.get("redirect_uri");
  void globalThis.fetch(`${redirectUri}/?${query}`);
};

const tokenEndpoint = (status: number, reply: unknown, sent: URLSearchParams[] = []) =>
  (async (_url: string, init: { body: URLSearchParams }) => {
    sent.push(init.body);
    return Response.json(reply, { status });
  }) as unknown as typeof fetch;

const LOGIN = { clientId: "id", clientSecret: "secret", scope: "a b", account: "the test account" };

describe("loginGoogle", () => {
  it("exchanges the code the browser brings back for the client and its refresh token", async () => {
    const sent: URLSearchParams[] = [];
    const credentials = await loginGoogle({
      ...LOGIN,
      open: browser("code=c1"),
      fetch: tokenEndpoint(200, { refresh_token: "rt" }, sent),
    });
    expect(credentials).toEqual({ clientId: "id", clientSecret: "secret", refreshToken: "rt" });
    expect(sent[0]?.get("code")).toBe("c1");
    expect(sent[0]?.get("grant_type")).toBe("authorization_code");
  });

  it("rejects a refused consent", async () => {
    const login = loginGoogle({ ...LOGIN, open: browser("error=access_denied"), fetch: tokenEndpoint(200, {}) });
    await expect(login).rejects.toThrow("consent refused: access_denied");
  });

  it("rejects a failed exchange and a reply without a refresh token", async () => {
    const failed = loginGoogle({ ...LOGIN, open: browser("code=c"), fetch: tokenEndpoint(400, { error: "bad" }) });
    await expect(failed).rejects.toThrow('token exchange: 400 {"error":"bad"}');
    const empty = loginGoogle({ ...LOGIN, open: browser("code=c"), fetch: tokenEndpoint(200, {}) });
    await expect(empty).rejects.toThrow("the reply has no refresh_token");
  });
});
