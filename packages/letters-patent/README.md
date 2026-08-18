# letters-patent

The umbrella package — the only thing consumers and integrations install.

- **Root** (`letters-patent`): the consumer surface — `defineSchema`,
  `defineCrest`, the `Contract`/`User` types, and runtime validation,
  re-exported from [`@letters-patent/schema`](../schema) and
  [`@letters-patent/core`](../core).
- **`letters-patent/kit`**: the provider surface — `defineProvider`,
  `defineState`, and the `Provider`/`State`/`Bridge` contracts, re-exported
  from [`@letters-patent/kit`](../kit).
- **`letters-patent/config`**: the declaration surface — `defineLettersPatentConfig`,
  an identity helper that pins a contract's literals without `as const`, for
  the one shared file the contract is declared in.

```ts
import { defineCrest, defineSchema } from "letters-patent";
import { createAuth0Provider } from "@letters-patent/auth0";

const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["admin", "editor"],
  meta: { plan: ["free", "pro"] },
});

const provider = createAuth0Provider(
  schema,
  { domain, clientId },
  (session) => ({
    id: session.sub,
    scopes: session.permissions,
    roles: session.groups,
    meta: { plan: session.app_metadata.plan },
  }),
);

const crest = defineCrest(schema, provider);

await crest.resolve();
crest.can("docs:write");
```
