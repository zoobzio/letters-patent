/**
 * The config file the CLI reads from the project root when `--config` is
 * absent.
 */
export const FILENAME = "patent.config.ts";

/** The default output directory, relative to the project root. */
export const OUT_DIR = "patent";

/**
 * The manifest file a write puts in the output directory. It lists the
 * paths the write produced; the next write removes each listed path its
 * output omits.
 */
export const MANIFEST = ".patent.json";

/** The re-emitted Protected Resource Metadata. */
export const RESOURCE = "resource.json";

/** The well-known path of an issuer's OpenID Connect discovery document. */
export const DISCOVERY = "/.well-known/openid-configuration";

/** The well-known path the app serves its Protected Resource Metadata at. */
export const WELL_KNOWN = "/.well-known/oauth-protected-resource";

/**
 * The sections of a claims request (OIDC Core §5.5). A claim under either
 * is requested; the build does not distinguish where it is delivered.
 */
export const SECTIONS = ["id_token", "userinfo"] as const;

/**
 * The grant types an authorization server supports when its discovery
 * document omits `grant_types_supported` (RFC 8414 §2).
 */
export const DEFAULT_GRANTS: readonly string[] = [
  "authorization_code",
  "implicit",
];
