import type { GoogleClaims } from "../src/types";

import { GOOGLE } from "../src/constant";
import { bytes, encode, random, sha256 } from "../src/util";

/**
 * An authorization code's binding: what the login flow asked for, read off
 * the authorization URL the provider produced.
 */
export interface Grant {
  nonce: string;
  challenge: string;
  /** Issue a refresh token with the code. */
  refresh?: boolean;
}

/**
 * A stand-in for Google's OAuth endpoints over an injected fetch: real RSA
 * keys, real JWTs, no network. The test drives the "browser" leg by hand —
 * parsing the authorization URL and minting a code — then lets the
 * provider talk to this for everything else.
 */
export interface FakeGoogle {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetch: typeof globalThis.fetch;
  /** The profile the next ID token carries; mutate to simulate change. */
  profile: Partial<GoogleClaims>;
  /** Every token and revoke call, oldest first. */
  calls: { url: string; form: URLSearchParams }[];
  /** Refresh tokens revoked through the revoke endpoint. */
  revoked: Set<string>;
  /** Standard claims as Google would issue them now. */
  claims(overrides?: Record<string, unknown>): Record<string, unknown>;
  /** Signs a JWT with the current key (or a given header). */
  sign(
    payload: Record<string, unknown>,
    header?: Record<string, unknown>,
  ): Promise<string>;
  /** Mints a single-use authorization code bound to a flow. */
  issue(grant: Grant): string;
  /** Rotates the signing key: new key id, old one gone. */
  rotate(): Promise<void>;
  /** How many times the key set was fetched. */
  jwksFetches: number;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const generate = async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { kid: random(8), privateKey: pair.privateKey, jwk };
};

export const fakeGoogle = async (): Promise<FakeGoogle> => {
  let key = await generate();
  const codes = new Map<string, Grant>();
  const refreshTokens = new Set<string>();

  const google: FakeGoogle = {
    clientId: "client-1.apps.googleusercontent.com",
    clientSecret: "GOCSPX-secret",
    redirectUri: "http://app.test/api/auth/callback",
    profile: {
      sub: "104958204857204857204",
      email: "ada@example.com",
      email_verified: true,
      name: "Ada Lovelace",
      picture: "https://lh3.googleusercontent.com/a/photo",
    },
    calls: [],
    revoked: new Set(),
    jwksFetches: 0,

    claims(overrides = {}) {
      const now = Math.floor(Date.now() / 1000);
      return {
        iss: "https://accounts.google.com",
        aud: google.clientId,
        azp: google.clientId,
        iat: now,
        exp: now + 3600,
        ...google.profile,
        ...overrides,
      };
    },

    async sign(payload, header = { alg: "RS256", kid: key.kid, typ: "JWT" }) {
      const head = encode(bytes(JSON.stringify(header)));
      const body = encode(bytes(JSON.stringify(payload)));
      const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key.privateKey,
        bytes(`${head}.${body}`),
      );
      return `${head}.${body}.${encode(new Uint8Array(signature))}`;
    },

    issue(grant) {
      const code = `4/${random(16)}`;
      codes.set(code, grant);
      return code;
    },

    async rotate() {
      key = await generate();
    },

    fetch: async (input, init) => {
      const url = String(input);

      if (url === GOOGLE.jwks) {
        google.jwksFetches += 1;
        return json({
          keys: [{ ...key.jwk, kid: key.kid, alg: "RS256", use: "sig" }],
        });
      }

      const form = new URLSearchParams(String(init?.body ?? ""));
      google.calls.push({ url, form });

      if (url === GOOGLE.revoke) {
        const token = form.get("token");
        if (token === null || !refreshTokens.has(token)) {
          return json({ error: "invalid_token" }, 400);
        }
        google.revoked.add(token);
        return json({});
      }

      if (url === GOOGLE.token) {
        if (
          form.get("client_id") !== google.clientId ||
          form.get("client_secret") !== google.clientSecret
        ) {
          return json({ error: "invalid_client" }, 401);
        }

        if (form.get("grant_type") === "authorization_code") {
          const code = form.get("code") ?? "";
          const grant = codes.get(code);
          codes.delete(code);
          const verifier = form.get("code_verifier") ?? "";
          if (
            grant === undefined ||
            form.get("redirect_uri") !== google.redirectUri ||
            encode(await sha256(verifier)) !== grant.challenge
          ) {
            return json({ error: "invalid_grant" }, 400);
          }
          const refresh = grant.refresh ? `1//${random(24)}` : undefined;
          if (refresh !== undefined) {
            refreshTokens.add(refresh);
          }
          return json({
            access_token: `ya29.${random(16)}`,
            expires_in: 3599,
            token_type: "Bearer",
            scope: "openid email profile",
            id_token: await google.sign(google.claims({ nonce: grant.nonce })),
            ...(refresh === undefined ? {} : { refresh_token: refresh }),
          });
        }

        if (form.get("grant_type") === "refresh_token") {
          const refresh = form.get("refresh_token") ?? "";
          if (!refreshTokens.has(refresh) || google.revoked.has(refresh)) {
            return json({ error: "invalid_grant" }, 400);
          }
          return json({
            access_token: `ya29.${random(16)}`,
            expires_in: 3599,
            token_type: "Bearer",
            id_token: await google.sign(google.claims()),
          });
        }

        return json({ error: "unsupported_grant_type" }, 400);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    },
  };

  return google;
};
