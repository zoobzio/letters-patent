# letters-patent

letters-patent is a type-safe authentication and authorization service whose
contract is built from the standards an app already speaks: its OAuth 2.0
Protected Resource Metadata (RFC 9728) names the scopes, an OpenID Connect
claims request names the roles, groups, entitlements, and claims it requires
of a user, and each issuer's discovery document says what the provider can
rely on. The user shape is the JWT access token profile of RFC 9068.

[`@letters-patent/kit`](./packages/kit) reads those documents and writes the
contract modules; the runtime, the provider SDK, and the framework modules
consume them, fully typed. A contract declared inline works the same way.

```ts
// patent.config.ts
import { defineConfig } from "@letters-patent/kit";

export default defineConfig({
  resource: "./auth/resource.json", // RFC 9728
  claims: "./auth/claims.json", // OIDC Core §5.5
  issuers: { google: "https://accounts.google.com" },
});
```

```sh
patent build
```

```ts
import { definePatent, defineSchema } from "letters-patent";
import config, { type Contract } from "./patent/config.mjs";

const patent = definePatent(defineSchema<Contract>(config.contract), provider);
patent.can("docs:write"); // the literals of the documents; a stranger fails to compile
```

A pnpm monorepo. Publishable packages live in [`packages/`](./packages);
framework bridges live in [`integrations/`](./integrations); authentication
providers live in [`providers/`](./providers); [`examples/`](./examples)
holds a built contract over Google.

## Development

```sh
make install    # install workspace dependencies
make stub       # link packages to source for dev
make check      # lint + typecheck + test
make help       # list all targets
```

Releases are versioned with [changesets](./.changeset) and cut manually via
the Release workflow.
