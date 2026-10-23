import type { Endpoints } from "./types";

/**
 * Google's OAuth 2.0 / OpenID Connect endpoints, as published in its
 * discovery document. Overridable per option for tests and proxies.
 */
export const GOOGLE: Endpoints = {
  authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  jwks: "https://www.googleapis.com/oauth2/v3/certs",
  revoke: "https://oauth2.googleapis.com/revoke",
};

/**
 * The issuer values Google signs ID tokens under — both forms are valid.
 */
export const ISSUERS: ReadonlySet<string> = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

/**
 * The scopes requested when the app declares none: an ID token with the
 * standard profile claims. `openid` is always added when absent, since the
 * flow needs an ID token.
 */
export const DEFAULT_SCOPES: readonly string[] = ["openid", "email", "profile"];

/** The session cookie's name when the app declares none. */
export const DEFAULT_COOKIE = "letters-patent";

/** The session lifetime in seconds when the app declares none: seven days. */
export const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * How long, in seconds, a login flow may take between leaving for Google
 * and returning to the callback.
 */
export const FLOW_MAX_AGE = 60 * 10;

/** The fewest characters a sealing secret may have. */
export const MIN_SECRET = 32;

/** How long, in milliseconds, a fetched set of signing keys is trusted. */
export const JWKS_TTL = 60 * 60 * 1000;

/**
 * How long, in milliseconds, before an unknown key id triggers a refetch of
 * the signing keys — a brake on a flood of forged tokens.
 */
export const JWKS_COOLDOWN = 60 * 1000;

/** Allowed clock drift, in seconds, when checking an ID token's times. */
export const CLOCK_SKEW = 60;
