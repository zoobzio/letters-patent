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
      // The bridge is instrumented: its result is already schema-proven.
      state.current = session ? bridge(session) : null;
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
