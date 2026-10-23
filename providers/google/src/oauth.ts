import type { Flow, Settings, Tokens } from "./types";

import { GoogleError } from "./error";
import { encode, record, sha256 } from "./util";

/**
 * The PKCE challenge for a verifier: its SHA-256, base64url encoded.
 */
const challenge = async (verifier: string): Promise<string> =>
  encode(await sha256(verifier));

/**
 * The URL at Google the browser is sent to for a login flow: the
 * authorization code request, bound to the flow's CSRF state, ID token
 * nonce, and PKCE challenge.
 */
export const authorize = async (
  settings: Settings,
  flow: Flow,
): Promise<string> => {
  const url = new URL(settings.endpoints.authorize);
  url.searchParams.set("client_id", settings.clientId);
  url.searchParams.set("redirect_uri", settings.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", settings.scopes.join(" "));
  url.searchParams.set("state", flow.state);
  url.searchParams.set("nonce", flow.nonce);
  url.searchParams.set("code_challenge", await challenge(flow.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  if (settings.offline) {
    url.searchParams.set("access_type", "offline");
  }
  if (settings.prompt !== undefined) {
    url.searchParams.set("prompt", settings.prompt);
  }
  if (settings.hostedDomain !== undefined) {
    url.searchParams.set("hd", settings.hostedDomain);
  }
  return url.toString();
};

/**
 * Posts a form to Google's token endpoint and reads the token answer,
 * surfacing Google's own error string on refusal.
 */
const grant = async (
  settings: Settings,
  form: Record<string, string>,
): Promise<Tokens> => {
  const response = await settings.fetch(settings.endpoints.token, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams(form).toString(),
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok || !record(body)) {
    const detail =
      record(body) && typeof body.error === "string" ? body.error : undefined;
    throw new GoogleError(
      "exchange",
      `Google refused the ${form.grant_type ?? "token"} grant${
        detail === undefined ? "" : ` (${detail})`
      }`,
      { statusCode: response.status === 400 ? 400 : 502, detail },
    );
  }
  return body as Tokens;
};

/**
 * Exchanges the authorization code the callback received for tokens,
 * proving possession of the flow's PKCE verifier.
 */
export const exchange = (
  settings: Settings,
  code: string,
  verifier: string,
): Promise<Tokens> =>
  grant(settings, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    redirect_uri: settings.redirectUri,
  });

/**
 * Obtains fresh tokens — including a fresh ID token — from a refresh token.
 */
export const renew = (settings: Settings, refresh: string): Promise<Tokens> =>
  grant(settings, {
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
  });

/**
 * Revokes a token at Google, invalidating the grant behind it. An already
 * invalid token is not a failure — the outcome is the same.
 */
export const revoke = async (
  settings: Settings,
  token: string,
): Promise<void> => {
  const response = await settings.fetch(settings.endpoints.revoke, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  });
  if (!response.ok && response.status !== 400) {
    throw new GoogleError("revoke", "Google refused to revoke the grant", {
      statusCode: 502,
    });
  }
};
