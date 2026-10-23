import type { H3Event } from "h3";

/**
 * Google's OAuth 2.0 endpoints. The defaults are Google's published ones;
 * each is overridable for tests and proxies.
 */
export interface Endpoints {
  authorize: string;
  token: string;
  jwks: string;
  revoke: string;
}

/**
 * The session cookie's attributes. `secure` defaults to whether the request
 * arrived over HTTPS (honouring `X-Forwarded-Proto`), so local development
 * over plain HTTP works without configuration.
 */
export interface CookieOptions {
  /** @default "letters-patent" */
  name?: string;
  /**
   * The session lifetime in seconds. The provider enforces it: an expired
   * cookie resolves to no user. `refresh` slides it.
   *
   * @default 604800 (seven days)
   */
  maxAge?: number;
  /** @default "/" */
  path?: string;
  domain?: string;
  /** @default "lax" */
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
}

/**
 * The provider's configuration — its own domain, acquired from the app's
 * environment and the request. The h3 event is the request context the
 * provider closes over: cookies, query, headers.
 */
export interface GoogleOptions {
  /** The current request. The provider is constructed once per request. */
  event: H3Event;

  /** The OAuth client id from the Google Cloud console. */
  clientId: string;

  /** The OAuth client secret from the Google Cloud console. */
  clientSecret: string;

  /**
   * The absolute URL Google sends the browser back to — the `callback`
   * action of the auth routes, e.g. `https://app.example/api/auth/callback`.
   * Must match an authorised redirect URI on the OAuth client.
   */
  redirectUri: string;

  /**
   * The secret the session cookie is sealed with (AES-GCM, key derived by
   * SHA-256). At least 32 characters; rotating it signs everyone out.
   */
  secret: string;

  /**
   * The OAuth scopes to request. `openid` is always included.
   *
   * @default ["openid", "email", "profile"]
   */
  scopes?: readonly string[];

  /**
   * Restrict sign-in to a Google Workspace domain: passed as the `hd` hint
   * and enforced on the ID token's `hd` claim.
   */
  hostedDomain?: string;

  /** The consent screen behaviour to request from Google. */
  prompt?: "none" | "consent" | "select_account";

  /**
   * Request a refresh token (`access_type=offline`). With one, `refresh`
   * obtains a fresh ID token from Google — picking up changed profile
   * claims — and `logout` revokes the grant. Google only issues a refresh
   * token the first time a user consents unless `prompt` is `"consent"`.
   *
   * @default false
   */
  offline?: boolean;

  /**
   * The in-app path to land on after a login that named no `redirect`
   * query parameter. A `redirect` on the login request wins when it is a
   * path within the app.
   *
   * @default "/"
   */
  redirect?: string;

  cookie?: CookieOptions;

  endpoints?: Partial<Endpoints>;

  /** The fetch used to reach Google. Injected by tests. */
  fetch?: typeof globalThis.fetch;
}

/**
 * The claims of a verified Google ID token — the payload the app's bridge
 * receives. `sub` is the stable Google account id; everything else depends
 * on the scopes granted. Google has no notion of the app's scopes or roles:
 * the bridge supplies those, most often from the app's own record of the
 * user looked up by `sub` or `email`.
 */
export interface GoogleClaims {
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
  azp?: string;
  nonce?: string;
  hd?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

/**
 * Google's answer from the token endpoint.
 */
export interface Tokens {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

/**
 * What the sealed session cookie holds: the verified claims the user was
 * established from, the session's own lifetime, and the refresh token when
 * Google issued one.
 */
export interface Session {
  claims: GoogleClaims;
  issued: number;
  expires: number;
  refresh?: string;
}

/**
 * What the sealed flow cookie holds between leaving for Google and the
 * callback: the CSRF state, the ID token nonce, the PKCE verifier, and the
 * in-app path to land on.
 */
export interface Flow {
  state: string;
  nonce: string;
  verifier: string;
  redirect: string;
}

/**
 * The options with every default applied — what the provider's internals
 * run on.
 */
export interface Settings {
  event: H3Event;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  secret: string;
  scopes: string[];
  hostedDomain?: string;
  prompt?: "none" | "consent" | "select_account";
  offline: boolean;
  redirect: string;
  cookie: Required<Omit<CookieOptions, "domain">> & { domain?: string };
  endpoints: Endpoints;
  fetch: typeof globalThis.fetch;
}
