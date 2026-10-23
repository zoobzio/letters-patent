# @letters-patent/google

Google sign-in for letters-patent: a server-side OpenID Connect authorization
code flow with PKCE, holding the session in a sealed, HTTP-only cookie. The
provider runs on the server over an [h3](https://h3.dev) event — the request
is its own domain — and is constructed once per request.

```ts
import { defineSchema } from "letters-patent";
import { createGoogleProvider } from "@letters-patent/google";

const schema = defineSchema(contract);

const provider = createGoogleProvider(
  schema,
  {
    event, // the h3 request event
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: "https://app.example/api/auth/callback",
    secret: process.env.SESSION_SECRET, // ≥ 32 characters, seals the cookie
  },
  async (claims) => {
    // Google knows who; the app knows what they may do.
    const account = await db.account.findBySubject(claims.sub);
    return {
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      avatar: claims.picture,
      verified: claims.email_verified,
      scopes: account?.scopes ?? [],
      roles: account?.roles ?? [],
      meta: { plan: account?.plan ?? "free" },
    };
  },
);
```

In the Google Cloud console, create an OAuth client of type **Web
application** and add `redirectUri` to its authorised redirect URIs. With the
Nuxt integration, that is `${origin}${prefix}/callback` — see
[`@letters-patent/nuxt`](../../integrations/nuxt#redirect-based-providers) for
the one-file wiring.

## The bridge

The bridge receives the verified ID token claims: `sub` (the stable Google
account id), and — subject to the scopes granted — `email`,
`email_verified`, `name`, `given_name`, `family_name`, `picture`, `locale`,
and `hd` (the Workspace domain). Google has no notion of the app's scopes
and roles; the bridge supplies them, most often by looking the user up in
the app's own records by `sub` or `email`. It may be asynchronous. The result
is proven against the contract before it becomes the user.

The bridge runs on every `resolve` — every request, under the Nuxt
integration — so grants drawn from the app's records are always current.
The provider adds the session's `issued` and `expires` to the user unless
the bridge set them itself, so `patent.stale` reports the session's own
lifetime.

## The flow

- **`login`** records the flow — CSRF `state`, ID token `nonce`, PKCE
  verifier, and the in-app path to land on — in a short-lived sealed cookie
  and returns Google's authorization URL as the continuation. A `redirect`
  query parameter on the login request names the landing path when it is a
  path within the app; otherwise the `redirect` option does (`/` by
  default).
- **`callback`** consumes the flow cookie, checks `state`, exchanges the
  code (with the PKCE verifier and the client secret), verifies the ID token
  — RS256 by one of Google's current keys, Google as issuer, this client as
  audience, within its validity window, carrying the flow's `nonce`, from
  the hosted domain when one is required — establishes the user through the
  bridge, seals the session, and returns the landing path.
- **`resolve`** opens the session cookie and establishes the user through
  the bridge; an absent, unopenable, or expired cookie is no user.
- **`refresh`** slides the session's lifetime. With a refresh token (see
  `offline`) it first obtains a fresh ID token from Google, so changed
  profile claims come through; a revoked grant ends the session.
- **`logout`** revokes the refresh token when there is one and clears the
  cookie.

The session cookie is AES-GCM sealed under a key derived from `secret`: the
browser can neither read nor alter it, and rotating the secret signs
everyone out. It is `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when
the request arrived over HTTPS.

## Options

| Option         | Default                          | Description                                                                                                      |
| -------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `event`        | — (required)                     | The h3 request event.                                                                                            |
| `clientId`     | — (required)                     | The OAuth client id.                                                                                             |
| `clientSecret` | — (required)                     | The OAuth client secret.                                                                                         |
| `redirectUri`  | — (required)                     | The absolute URL of the `callback` action, as authorised on the OAuth client.                                    |
| `secret`       | — (required)                     | The cookie sealing secret, at least 32 characters.                                                               |
| `scopes`       | `["openid", "email", "profile"]` | The OAuth scopes to request. `openid` is always included.                                                        |
| `hostedDomain` | —                                | Restrict sign-in to a Google Workspace domain: the `hd` hint, enforced on the ID token.                          |
| `prompt`       | —                                | `"none"`, `"consent"`, or `"select_account"`.                                                                    |
| `offline`      | `false`                          | Request a refresh token. Google issues one on first consent only, unless `prompt` is `"consent"`.                |
| `redirect`     | `"/"`                            | The landing path when the login request names no `redirect`.                                                     |
| `cookie`       | see below                        | `name` (`"letters-patent"`), `maxAge` in seconds (seven days), `path`, `domain`, `sameSite` (`"lax"`), `secure`. |
| `endpoints`    | Google's                         | Override `authorize`, `token`, `jwks`, or `revoke` for tests and proxies.                                        |
| `fetch`        | `globalThis.fetch`               | The fetch used to reach Google.                                                                                  |

## Errors

A `GoogleError` carries where the flow failed in `code` — `configuration`,
`denied` (Google refused the authorization: the user declined, the hosted
domain did not match), `flow` (no flow in progress, `state` mismatch, no
code), `exchange`, `token`, `revoke` — Google's own error string in
`detail` when there is one, and a `statusCode` an h3 server answers with
instead of a 500.
