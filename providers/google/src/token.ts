import type { GoogleClaims, Settings } from "./types";

import { CLOCK_SKEW, ISSUERS, JWKS_COOLDOWN, JWKS_TTL } from "./constant";
import { GoogleError } from "./error";
import { bytes, decode, record, text } from "./util";

interface KeySet {
  keys: Map<string, CryptoKey>;
  fetched: number;
}

/**
 * Google's signing keys, cached per JWKS URL. Google rotates them
 * regularly; a set is trusted for an hour, and an unknown key id triggers
 * a refetch — rate-limited so a stream of forged tokens cannot turn the
 * provider into a request amplifier.
 */
const sets = new Map<string, Promise<KeySet>>();

const load = async (settings: Settings): Promise<KeySet> => {
  const response = await settings.fetch(settings.endpoints.jwks, {
    headers: { accept: "application/json" },
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok || !record(body) || !Array.isArray(body.keys)) {
    throw new GoogleError("token", "Google's signing keys are unavailable", {
      statusCode: 502,
    });
  }
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys as unknown[]) {
    if (!record(jwk) || typeof jwk.kid !== "string" || jwk.kty !== "RSA") {
      continue;
    }
    keys.set(
      jwk.kid,
      await crypto.subtle.importKey(
        "jwk",
        jwk as JsonWebKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      ),
    );
  }
  return { keys, fetched: Date.now() };
};

const keyset = (settings: Settings, force = false): Promise<KeySet> => {
  const url = settings.endpoints.jwks;
  const cached = sets.get(url);
  if (cached !== undefined && !force) {
    return cached;
  }
  const loading = load(settings);
  sets.set(url, loading);
  loading.catch(() => {
    if (sets.get(url) === loading) {
      sets.delete(url);
    }
  });
  return loading;
};

/**
 * The signing key for a key id, refetching the set when it is stale or does
 * not know the id (and the last fetch is not too recent).
 */
const signer = async (
  settings: Settings,
  kid: string,
): Promise<CryptoKey | undefined> => {
  let set = await keyset(settings);
  const age = Date.now() - set.fetched;
  if (age > JWKS_TTL || (!set.keys.has(kid) && age > JWKS_COOLDOWN)) {
    set = await keyset(settings, true);
  }
  return set.keys.get(kid);
};

/** Forget every cached key set. Tests call it between cases. */
export const forget = (): void => {
  sets.clear();
};

const section = (part: string | undefined, name: string): unknown => {
  if (part === undefined) {
    throw new GoogleError("token", `The ID token has no ${name}`);
  }
  try {
    return JSON.parse(text(decode(part)));
  } catch {
    throw new GoogleError("token", `The ID token's ${name} is malformed`);
  }
};

/**
 * Verifies a Google ID token and returns its claims: an RS256 signature by
 * one of Google's current keys, Google as issuer, this client as audience,
 * within its validity window, carrying the flow's nonce when one is
 * expected, and from the configured hosted domain when one is required.
 */
export const verify = async (
  settings: Settings,
  token: string,
  expected: { nonce?: string } = {},
): Promise<GoogleClaims> => {
  const [head, body, signature, ...rest] = token.split(".");
  if (rest.length > 0 || signature === undefined) {
    throw new GoogleError("token", "The ID token is not a compact JWT");
  }

  const header = section(head, "header");
  if (
    !record(header) ||
    header.alg !== "RS256" ||
    typeof header.kid !== "string"
  ) {
    throw new GoogleError("token", "The ID token is not RS256-signed");
  }

  const key = await signer(settings, header.kid);
  if (key === undefined) {
    throw new GoogleError("token", "The ID token's signing key is unknown");
  }
  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode(signature),
      bytes(`${head}.${body}`),
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new GoogleError("token", "The ID token's signature is invalid");
  }

  const claims = section(body, "payload");
  if (
    !record(claims) ||
    typeof claims.sub !== "string" ||
    typeof claims.iss !== "string" ||
    typeof claims.aud !== "string" ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number"
  ) {
    throw new GoogleError("token", "The ID token lacks the standard claims");
  }
  if (!ISSUERS.has(claims.iss)) {
    throw new GoogleError("token", "The ID token was not issued by Google");
  }
  if (claims.aud !== settings.clientId) {
    throw new GoogleError("token", "The ID token is for another client");
  }
  const now = Date.now() / 1000;
  if (claims.exp + CLOCK_SKEW < now) {
    throw new GoogleError("token", "The ID token has expired");
  }
  if (claims.iat - CLOCK_SKEW > now) {
    throw new GoogleError("token", "The ID token is from the future");
  }
  if (expected.nonce !== undefined && claims.nonce !== expected.nonce) {
    throw new GoogleError("token", "The ID token's nonce does not match");
  }
  if (
    settings.hostedDomain !== undefined &&
    claims.hd !== settings.hostedDomain
  ) {
    throw new GoogleError("token", "The account is outside the hosted domain");
  }

  return claims as unknown as GoogleClaims;
};
