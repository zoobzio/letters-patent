# providers

Published letters-patent providers: each wraps one authentication service as the
`Provider<C>` callbacks from [`@letters-patent/kit`](../packages/kit), authored
with `defineProvider`. An app closes the contract with its bridge; the provider
never sees one.

- [`@letters-patent/google`](./google) — Google sign-in over OpenID Connect.
