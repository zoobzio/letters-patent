/**
 * The scalar keywords a meta {@link Field} declaration may name, without
 * the `?` suffix.
 */
export const KEYWORDS = new Set<string>([
  "string",
  "number",
  "boolean",
  "string[]",
  "number[]",
]);

/**
 * The vocabularies every {@link Contract} declares: the authorization
 * claims of RFC 9068 §2.2.3.1, pluralized as the contract names them.
 */
export const VOCABULARIES = [
  "scopes",
  "roles",
  "groups",
  "entitlements",
] as const;

/**
 * The members every {@link Contract} carries.
 */
export const CONTRACT_KEYS: readonly string[] = [...VOCABULARIES, "meta"];

/**
 * The members every {@link User} carries; the rest of the shape is optional.
 */
export const REQUIRED_USER_KEYS: readonly string[] = ["sub", "meta"];
