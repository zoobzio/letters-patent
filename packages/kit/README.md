# @letters-patent/kit

The kit reads the standard documents an app already has for its
authorization story and writes the modules the letters-patent runtime needs.
The input is three documents; a `patent.config.ts` points at them.

| Document         | Standard                                        | What it gives the contract                                                       |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `resource.json`  | OAuth 2.0 Protected Resource Metadata, RFC 9728 | `scopes_supported` → the scope vocabulary                                        |
| `claims.json`    | OpenID Connect claims request, Core §5.5        | `roles`/`groups`/`entitlements` → vocabularies; every other claim → a meta field |
| issuer discovery | OpenID Connect Discovery / RFC 8414             | endpoints and capabilities, per issuer                                           |

The user shape the contract rules is the JWT access token profile of RFC 9068:
`sub`, `iat`, `exp`, `scope`, and the `roles`, `groups`, and `entitlements`
claims from the SCIM user schema (RFC 7643 §4.1.2).

```ts
// patent.config.ts
import { defineConfig } from "@letters-patent/kit";

export default defineConfig({
  resource: "./auth/resource.json",
  claims: "./auth/claims.json",
  issuers: { google: "https://accounts.google.com" }, // or a vendored discovery.json
  describe: { scopes: { "docs:write": "Create and edit documents" } },
});
```

```jsonc
// auth/resource.json — servable at /.well-known/oauth-protected-resource
{
  "resource": "https://app.example",
  "authorization_servers": ["https://accounts.google.com"],
  "scopes_supported": ["docs:read", "docs:write"]
}

// auth/claims.json — what the app requires of a user
{
  "id_token": {
    "email": { "essential": true },
    "roles": { "essential": true, "values": ["admin", "editor"] },
    "groups": { "values": ["eng", "sales"] },
    "plan": { "essential": true, "values": ["free", "pro"] },
    "org": { "essential": true },
    "locale": null
  }
}
```

```sh
patent build
```

## How a claims request lowers

- `roles`, `groups`, `entitlements` must declare `values`; they become the
  vocabularies. A missing one is an empty vocabulary.
- `sub`, `email`, `email_verified`, `name`, `preferred_username`, and
  `picture` are members of `User`; naming them records that the app needs
  them, and the build checks each issuer publishes them.
- Every other claim becomes a meta field. `values` makes an enum; otherwise
  the keyword comes from `types` in the config, the OpenID Connect standard
  claims table (`locale` is a string, `updated_at` a number, `amr` a string
  list), or defaults to `string`. `essential: true` makes the member
  required; otherwise it is optional.
- `scope` and the token claims (`iss`, `aud`, `exp`, `iat`, …) cannot be
  requested as user attributes. `address` is structured and not supported.

## Output

The build writes to `patent/` (the `outDir` option):

- **`index`** — the `Scope`, `Role`, `Group`, and `Entitlement` unions, the
  vocabulary lists, and the `isScope`, `isRole`, `isGroup`, and
  `isEntitlement` guards.
- **`config`** — the `contract` and the `Contract`, `Meta`, and `User`
  types with every literal. `defineSchema<Contract>(config.contract)` types
  the service.
- **`manifest`** — each vocabulary member and requested claim with an id, a
  titled name, and the description `describe` gives it, for a consent screen
  or an admin console. The standards carry no text for these, so the config
  is where it lives.
- **`issuers/<id>`** — one module per issuer: its endpoints (`authorize`,
  `token`, `jwks`, `userinfo`, `revoke`, `endSession`, `introspect`, as
  published), its capabilities as literal booleans (`code`, `pkce`,
  `refresh`, `revoke`, `endSession`, `userinfo`), its scopes, and a `Claims`
  interface from `claims_supported`. **`issuers`** lists them.
- **`resource.json`** — the Protected Resource Metadata as authored, to
  serve at `/.well-known/oauth-protected-resource`.

Each module is an `.mjs` file with a `.d.mts` beside it. A `.patent.json`
manifest records what was written, so the next build removes what it no
longer produces and leaves anything else in the directory alone.

```ts
import { definePatent, defineSchema } from "letters-patent";
import config, { type Contract } from "./patent/config.mjs";
import google from "./patent/issuers/google.mjs";

const schema = defineSchema<Contract>(config.contract);
const patent = definePatent(schema, provider);

patent.can("docs:write"); // Scope
patent.is("admin"); // Role
patent.in("eng"); // Group
google.caps.refresh; // true, as a literal type
```

## Verification

The build fails on a document that is not what its standard says it is: a
resource with no `resource` URL, a claims request with an unknown section,
a discovery document without a token endpoint, a vocabulary that repeats a
name. It warns, and goes on, about what the documents cannot settle:

- a requested claim an issuer does not publish — the bridge must supply it
  from the app's own records (an app's `roles` and `plan` are never Google's
  to know);
- an issuer without PKCE, the authorization code grant, the refresh token
  grant, or a `jwks_uri`;
- an issuer not listed in the resource's `authorization_servers`, or a
  listed server with no issuer in the config.

## API

- `defineConfig(config)` types a `patent.config.ts`.
- `build(options)` runs the whole build: load, generate, write. The CLI
  calls it.
- `generate(config, options)` resolves and emits without writing.
- `resolveKit(config, options)` reads the documents and returns the
  contract, the issuers, the manifest, the documents read, and the
  warnings. A framework module uses this form.
- `emit(core)` turns a contract — with or without a resource and issuers —
  into the files. `@letters-patent/nuxt` emits the same modules the CLI
  writes.
- `parseResource`, `parseClaims`, `parseDiscovery` read one document each; `assemble` builds and proves the contract; `verify`
  cross-checks the documents.
