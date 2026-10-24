import type { Contract, Field, Keyword } from "@letters-patent/schema";

/**
 * Where a document lives: a path relative to the project root, or an
 * absolute `file:` or `https:` URL.
 */
export type Source = string | URL;

/**
 * Descriptions for the manifest, keyed by member id. A description here
 * wins over one read from an OpenAPI document.
 */
export interface Describe {
  scopes?: Record<string, string>;
  roles?: Record<string, string>;
  groups?: Record<string, string>;
  entitlements?: Record<string, string>;
  claims?: Record<string, string>;
}

/**
 * The authored `patent.config.ts`: which standard documents the contract is
 * built from, and where the build writes.
 */
export interface KitConfig {
  /**
   * The app's OAuth 2.0 Protected Resource Metadata (RFC 9728). Its
   * `scopes_supported` is the scope vocabulary; its `authorization_servers`
   * name the issuers the app trusts. The build re-emits the document as
   * `resource.json`, ready to serve at
   * `/.well-known/oauth-protected-resource`.
   */
  resource: Source;

  /**
   * An OpenID Connect claims request (OIDC Core §5.5): the claims the app
   * requires of a user, under `id_token` or `userinfo`. `roles`, `groups`,
   * and `entitlements` with `values` become the vocabularies (RFC 9068
   * §2.2.3.1); every other claim becomes a meta field — `values` an enum,
   * `essential` whether the member is required. The profile claims a user
   * carries directly (`email`, `name`, `picture`, …) are recorded for
   * verification against the issuers. Without a document, the vocabularies
   * beyond scopes are empty and meta has no members.
   */
  claims?: Source;

  /**
   * The issuers, by id: each a discovery document (OpenID Connect
   * Discovery / RFC 8414), or an issuer identifier the build fetches
   * `/.well-known/openid-configuration` from. The build emits one module
   * per issuer with its endpoints and capabilities, and warns when a
   * requested claim or scope is outside what the issuer publishes.
   */
  issuers?: Record<string, Source>;

  /**
   * An OpenAPI document whose `oauth2` security schemes describe the scopes.
   * The scope descriptions reach the manifest. RFC 9728 lists scopes but
   * carries no text for them.
   */
  openapi?: Source;

  /**
   * Descriptions for the manifest, by member id. These win over the OpenAPI
   * document.
   */
  describe?: Describe;

  /**
   * The type of a custom claim that declares no `values`. A claims request
   * carries no types; a claim absent here, and outside the OpenID Connect
   * standard claims, is a string.
   */
  types?: Record<string, Keyword>;

  /**
   * The output directory, relative to the project root. Defaults to
   * `patent`.
   */
  outDir?: string;
}

/**
 * The app's Protected Resource Metadata as read: the required members
 * normalized, every other member passed through to `resource.json`.
 */
export interface Resource {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  [key: string]: unknown;
}

/**
 * One requested claim, as the claims request declares it.
 */
export interface Claim {
  name: string;
  essential: boolean;
  values?: (string | number)[];
}

/**
 * The claims request read apart: the vocabularies, the profile claims a
 * user carries directly, and the meta fields the rest lower to.
 */
export interface Claims {
  /** Every claim in the document, in authored order. */
  requested: Claim[];

  roles: string[];
  groups: string[];
  entitlements: string[];

  /** Requested claims that are members of `User`: `email`, `name`, … */
  profile: string[];

  /** The meta construction the other claims lower to. */
  meta: Record<string, Field>;
}

/**
 * An issuer's endpoints, as its discovery document names them. `authorize`
 * and `token` are always present; the rest when the issuer publishes them.
 */
export interface Endpoints {
  authorize: string;
  token: string;
  jwks?: string;
  userinfo?: string;
  revoke?: string;
  endSession?: string;
  introspect?: string;
}

/**
 * What an issuer can do for a provider, read off its discovery document.
 */
export interface Caps {
  /** The authorization code grant is supported. */
  code: boolean;
  /** PKCE with `S256` is supported. */
  pkce: boolean;
  /** The refresh token grant is supported — a provider can implement `refresh` against it. */
  refresh: boolean;
  /** A revocation endpoint (RFC 7009) is published — `logout` can revoke. */
  revoke: boolean;
  /** An end-session endpoint (RP-Initiated Logout) is published. */
  endSession: boolean;
  /** A userinfo endpoint is published. */
  userinfo: boolean;
}

/**
 * One issuer, read from its discovery document.
 */
export interface Issuer {
  id: string;
  issuer: string;
  endpoints: Endpoints;
  caps: Caps;
  /** `scopes_supported`: the issuer's own scopes, such as `openid email profile`. */
  scopes: string[];
  /** `claims_supported`: the claims the issuer can issue. */
  claims: string[];
}

/** An interface entry for a vocabulary member. */
export interface Entry {
  id: string;
  name: string;
  description?: string;
}

/** An interface entry for a requested claim. */
export interface ClaimEntry extends Entry {
  essential: boolean;
  values?: (string | number)[];
}

/**
 * The vocabularies and claims of a build as an interface presents them: a
 * consent screen, an admin console.
 */
export interface Manifest {
  scopes: Entry[];
  roles: Entry[];
  groups: Entry[];
  entitlements: Entry[];
  claims: ClaimEntry[];
}

/**
 * The validated core of a build: what the emitters read. A consumer that
 * holds only a contract — a framework module given one inline — omits the
 * rest; the emitters then derive a manifest with titled ids and write no
 * issuer or resource files.
 */
export interface Core {
  /** The contract, proven. */
  contract: Contract;

  /** The Protected Resource Metadata the scopes came from. */
  resource?: Resource;

  /** The issuers, in config order. */
  issuers?: Issuer[];

  /** The manifest. Derived from the contract when omitted. */
  manifest?: Manifest;
}

/**
 * A resolved config: the {@link Core} with every member present, the output
 * directory, the local documents the build read, and the warnings the
 * verification raised.
 */
export interface Kit extends Core {
  resource: Resource;
  issuers: Issuer[];
  manifest: Manifest;
  claims: Claims;

  /** The output directory, normalized and relative to the project root. */
  outDir: string;

  /**
   * The absolute path of each local document the build read. A dev server
   * watches these paths to rebuild on change.
   */
  documents: string[];

  /** What verification found short of an error. */
  warnings: string[];
}

/** One emitted file. `path` is relative to the output directory. */
export interface OutputFile {
  path: string;
  contents: string;
}

/** What {@link generate} returns. */
export interface Output {
  outDir: string;
  files: OutputFile[];
  warnings: string[];
}

/**
 * The document loader every read goes through. Receives a document URL and
 * returns its text.
 */
export type Req = (src: URL) => Promise<string>;

/** The I/O hooks of a build. */
export interface GenerateOptions {
  /** The project root relative sources resolve against. Defaults to `process.cwd()`. */
  cwd?: string;

  /**
   * The loader for every document the build reads. Defaults to the
   * filesystem for `file:` URLs and to `fetch` for all other URLs.
   */
  req?: Req;
}

/** Options for {@link build}: the project location and the I/O hooks. */
export type BuildOptions = Omit<GenerateOptions, "cwd"> & {
  /** The project root. Defaults to `process.cwd()`. */
  root?: string;

  /** The config file, relative to `root`. Defaults to `patent.config.ts`. */
  config?: string;
};
