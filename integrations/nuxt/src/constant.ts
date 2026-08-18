/**
 * The default route prefix the browser dials and the server handlers mount
 * under, overridable via the module's `prefix` option. The client transport
 * calls `${prefix}/session`, `${prefix}/login`, etc.; the user's
 * `defineAuthHandlers` route file lives at the matching Nitro path — for
 * the default, `server/api/auth/[action].ts`.
 */
export const DEFAULT_PREFIX = "/api/auth";

/**
 * The default route the `auth` middleware sends unauthenticated visitors
 * to, overridable via the module's `login` option. The middleware appends
 * the attempted path as a `redirect` query parameter.
 */
export const DEFAULT_LOGIN = "/login";

/** The `useState` key the auth service's state is held under. */
export const STATE_KEY = "letters-patent:user";
