# @letters-patent/core

The service runtime. `definePatent` takes a schema (the validation bundle
derived from a contract by [`@letters-patent/schema`](../schema)) and a provider
(the callbacks from [`@letters-patent/sdk`](../sdk)) and returns the service:
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
import { definePatent } from "@letters-patent/core";

const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["admin", "editor"],
  meta: { plan: ["free", "pro"] },
});

const patent = definePatent(schema, provider);

await patent.resolve();      // provider establishes state from ambient context
patent.current;              // typed by the contract, or null
patent.can("docs:write");    // scope check (all required); emits "denied"
patent.is("admin");          // role check (any of); emits "denied"
patent.stale;                // expires passed? reported, never acted on
patent.on("change", (u) => { ... });
```
