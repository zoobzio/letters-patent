import type { Keyword } from "@letters-patent/schema";

/**
 * The vocabulary claims: the authorization claims of RFC 9068 §2.2.3.1
 * beyond `scope`, each a multi-valued list of names drawn from the SCIM
 * user schema (RFC 7643 §4.1.2).
 */
export const VOCABULARY_CLAIMS = ["roles", "groups", "entitlements"] as const;

/**
 * The claims a `User` carries as members of its own, under their registered
 * names. A claims request names them to say the app needs them; nothing
 * lowers to meta.
 */
export const PROFILE_CLAIMS: ReadonlySet<string> = new Set([
  "sub",
  "email",
  "email_verified",
  "name",
  "preferred_username",
  "picture",
]);

/**
 * The claims a claims request may not name as user attributes, with the
 * reason. Token-level claims belong to the token, not the user; `scope`
 * comes from the resource document.
 */
export const RESERVED_CLAIMS: Readonly<Record<string, string>> = {
  scope: "the scope vocabulary comes from the resource document",
  iss: "a token claim, not a user attribute",
  aud: "a token claim, not a user attribute",
  exp: "a token claim; letters-patent sets it from the session",
  iat: "a token claim; letters-patent sets it from the session",
  nbf: "a token claim, not a user attribute",
  jti: "a token claim, not a user attribute",
  nonce: "a token claim, not a user attribute",
  azp: "a token claim, not a user attribute",
  at_hash: "a token claim, not a user attribute",
  c_hash: "a token claim, not a user attribute",
  client_id: "a token claim, not a user attribute",
};

/**
 * Structured claims a meta field cannot carry.
 */
export const UNSUPPORTED_CLAIMS: Readonly<Record<string, string>> = {
  address: "a structured claim; meta fields are scalars",
};

/**
 * The OpenID Connect standard claims (Core §5.1) that lower to meta, with
 * the keyword each has. A standard claim needs no `types` entry in the
 * config.
 */
export const STANDARD_CLAIMS: Readonly<Record<string, Keyword>> = {
  given_name: "string",
  family_name: "string",
  middle_name: "string",
  nickname: "string",
  profile: "string",
  website: "string",
  gender: "string",
  birthdate: "string",
  zoneinfo: "string",
  locale: "string",
  phone_number: "string",
  phone_number_verified: "boolean",
  updated_at: "number",
  auth_time: "number",
  acr: "string",
  amr: "string[]",
};

/**
 * The TypeScript type of each registered claim, for the `Claims` type an
 * issuer module declares from `claims_supported`. A claim outside the table
 * is `unknown`.
 */
export const CLAIM_TYPES: Readonly<Record<string, string>> = {
  sub: "string",
  iss: "string",
  aud: "string | string[]",
  exp: "number",
  iat: "number",
  nbf: "number",
  jti: "string",
  auth_time: "number",
  nonce: "string",
  acr: "string",
  amr: "string[]",
  azp: "string",
  at_hash: "string",
  c_hash: "string",
  scope: "string",
  client_id: "string",
  roles: "string[]",
  groups: "string[]",
  entitlements: "string[]",
  name: "string",
  given_name: "string",
  family_name: "string",
  middle_name: "string",
  nickname: "string",
  preferred_username: "string",
  profile: "string",
  picture: "string",
  website: "string",
  email: "string",
  email_verified: "boolean",
  gender: "string",
  birthdate: "string",
  zoneinfo: "string",
  locale: "string",
  phone_number: "string",
  phone_number_verified: "boolean",
  updated_at: "number",
  address:
    "{ formatted?: string; street_address?: string; locality?: string; region?: string; postal_code?: string; country?: string }",
};
