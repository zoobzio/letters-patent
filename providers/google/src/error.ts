/**
 * Where a Google flow failed.
 *
 * - `configuration` — the options are unusable (a short secret)
 * - `denied` — Google answered the authorization request with an error
 *   (the user declined, the hosted domain did not match, …)
 * - `flow` — the callback arrived without a matching login flow: no flow
 *   cookie, a `state` mismatch, or no code
 * - `exchange` — the token endpoint refused the code or refresh token
 * - `token` — the ID token failed verification
 * - `revoke` — Google refused to revoke the grant
 */
export type GoogleCode =
  | "configuration"
  | "denied"
  | "flow"
  | "exchange"
  | "token"
  | "revoke";

/**
 * A failure in the Google flow. Carries a `statusCode` so an h3 server
 * answers with it rather than a 500, and `detail` with Google's own error
 * string when there is one (`invalid_grant`, `access_denied`, …).
 */
export class GoogleError extends Error {
  readonly code: GoogleCode;
  readonly statusCode: number;
  readonly detail?: string;

  constructor(
    code: GoogleCode,
    message: string,
    options: { statusCode?: number; detail?: string } = {},
  ) {
    super(message);
    this.name = "GoogleError";
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    if (options.detail !== undefined) {
      this.detail = options.detail;
    }
  }
}
