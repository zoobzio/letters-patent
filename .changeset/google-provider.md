---
"@letters-patent/kit": patch
"@letters-patent/nuxt": patch
"@letters-patent/google": patch
"letters-patent": patch
---

Add the Google provider and the return leg redirect-based flows need.

- `@letters-patent/kit`: a bridge may be asynchronous — `defineProvider`
  awaits it before proving the result, so an app can look its user up in
  its own records at the boundary. `login` may return a `Redirect` to
  continue out-of-band, and the new optional `callback` completes the flow
  when the auth host sends the browser back.
- `@letters-patent/nuxt`: `defineAuthHandlers` dispatches the `callback`
  action and answers a continuation with a 302 for a navigating browser or
  as data for the transport, which navigates itself.
- `@letters-patent/google`: a server-side OpenID Connect authorization code
  flow with PKCE over an h3 event, with ID token verification against
  Google's published keys, a sealed HTTP-only session cookie, refresh, and
  revocation on logout.
