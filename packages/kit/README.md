# @letters-patent/kit

The provider-authoring toolkit. This package owns the `Provider<C>`
interaction contract, the `Bridge` between a vendor's payloads and an app's
contract, and `defineProvider` — the entry point published integrations
(`@letters-patent/auth0`, …) and homegrown providers share.

A provider is a set of callbacks over letters-patent's own domain objects: each
receives the shared `State<C>` and the `Schema<C>`, and assigns
`state.current` to hand letters-patent what it needs — proving vendor payloads
with the schema at its own boundary. Everything else a flow requires —
configuration, credentials, request context — is the provider's own,
acquired in its own domain; letters-patent defines none of it.

The author writes the implementation in vendor terms and never sees a
contract; the app closes the contract with its bridge, in one call:

```ts
// published: @letters-patent/auth0 — knows sessions and flows, never a contract
export const createAuth0Provider = defineProvider<Auth0Options, Auth0Session>(
  (options, bridge) => ({
    login: async (state) => { ... }, // untouched state = out-of-band
    logout: async (state) => { ... },
    resolve: async (state) => {
      const session = await readSession(options);
      // The bridge is instrumented: it is awaited, and its result is
      // already schema-proven.
      state.current = session ? await bridge(session) : null;
    },
  }),
);

// app: the schema pins the contract; the bridge is checked against it
const provider = createAuth0Provider(schema, { domain, clientId }, (session) => ({
  id: session.sub,
  scopes: session.permissions,
  roles: session.groups,
  meta: { plan: session.app_metadata.plan },
}));
```

A bridge may be asynchronous. An auth host rarely knows the app's scopes and
roles; the bridge is where the app looks its own record up by what the host
does know and grants from there:

```ts
const provider = createGoogleProvider(schema, options, async (claims) => {
  const account = await db.account.findBySubject(claims.sub);
  return {
    id: claims.sub,
    email: claims.email,
    scopes: account?.scopes ?? [],
    roles: account?.roles ?? [],
    meta: { plan: account?.plan ?? "free" },
  };
});
```

## Redirect-based flows

A flow that leaves the app — OAuth, OpenID Connect — has two legs, and the
contract has a callback for each. `login` returns a `Redirect` naming the
authorization URL at the auth host and leaves state untouched. When the host
sends the browser back, `callback` consumes what it handed over from the
provider's own request context, establishes the session, assigns
`state.current`, and returns the `Redirect` to land on within the app.

```ts
login: async () => {
  const flow = beginFlow(options); // state, nonce, verifier → a cookie
  return { location: authorizationUrl(options, flow) };
},
callback: async (state) => {
  const flow = endFlow(options); // the cookie, checked against the query
  const claims = await exchangeAndVerify(options, flow);
  state.current = await bridge(claims);
  return { location: flow.redirect };
},
```

A `Redirect` is data: the provider never writes a response. The host — an
integration's server handlers — turns it into a 302 for a navigating browser
or hands it to the browser transport as data. `callback` is driven by those
handlers alone; the service's own lifecycle has `login`, `logout`, `resolve`,
and `refresh`.
