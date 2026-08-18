# @letters-patent/core

The service runtime. `defineCrest` takes a schema (the validation bundle
derived from a contract by [`@letters-patent/schema`](../schema)) and a provider
(the callbacks from [`@letters-patent/kit`](../kit)) and returns the service:
current user state behind the schema-guarded proxy, authorization checks
against the contract's vocabulary, and a no-argument lifecycle that invokes
the provider with letters-patent's own domain objects — the guarded state and the
schema.

Every write to state — a provider assignment, a deep mutation from anywhere
— is proven against the contract before it commits, and every committed
write emits `change`. The checks carry the contract in their types: an
undeclared scope or role fails to compile.

```ts
import { defineSchema } from "@letters-patent/schema";
import { defineCrest } from "@letters-patent/core";

const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["admin", "editor"],
  meta: { plan: ["free", "pro"] },
});

const crest = defineCrest(schema, provider);

await crest.resolve();      // provider establishes state from ambient context
crest.current;              // typed by the contract, or null
crest.can("docs:write");    // scope check (all required); emits "denied"
crest.is("admin");          // role check (any of); emits "denied"
crest.stale;                // expires passed? reported, never acted on
crest.on("change", (u) => { ... });
```
