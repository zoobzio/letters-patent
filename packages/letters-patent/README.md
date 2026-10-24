# letters-patent

The umbrella package — the only thing consumers and integrations install.

- **Root** (`letters-patent`): the consumer surface — `defineSchema`,
  `definePatent`, the `Contract`/`User` types, and runtime validation,
  re-exported from [`@letters-patent/schema`](../schema) and
  [`@letters-patent/core`](../core).
- **`letters-patent/sdk`**: the provider surface — `defineProvider`,
  `defineState`, and the `Provider`/`State`/`Bridge` contracts, re-exported
  from [`@letters-patent/sdk`](../sdk).
- **`letters-patent/config`**: the declaration surface — `defineLettersPatentConfig`,
  an identity helper that pins a contract's literals without `as const`, for
  an app that declares its contract inline rather than building it with
  [`@letters-patent/kit`](../kit).

```ts
import { definePatent, defineSchema } from "letters-patent";
import { createGoogleProvider } from "@letters-patent/google";

const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["admin", "editor"],
  meta: { plan: ["free", "pro"] },
});

const provider = createGoogleProvider(
  schema,
  { event, clientId, clientSecret, redirectUri, secret },
  async (claims) => {
    const account = await db.account.findBySubject(claims.sub);
    return {
      id: claims.sub,
      email: claims.email,
      scopes: account?.scopes ?? [],
      roles: account?.roles ?? [],
      meta: { plan: account?.plan ?? "free" },
    };
  },
);

const patent = definePatent(schema, provider);

await patent.resolve();
patent.can("docs:write");
```
