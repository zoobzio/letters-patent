# @letters-patent/schema

The contracts letters-patent is built on: the `User<Meta>` shape and runtime
validation derived from a consumer-authored contract. Validation is built on
rule lists over the guards in
[`objectively`](https://www.npmjs.com/package/objectively) — everything else
in the workspace sits on this package.

## The contract

A contract is a static, serializable configuration: which scopes and roles
exist, and how the consumer-defined meta is constructed. It is plain data —
it can be written to a build template or sent over a wire — and it carries
the vocabulary in its types: declared inline, its literals become the
`Scope`, `Role`, and `Meta` types by inference.

```ts
import { defineSchema } from "@letters-patent/schema";

const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["admin", "editor"],
  meta: {
    plan: ["free", "pro"], // enum  → "free" | "pro"
    org: "string", //               → string
    age: "number?", // ?-suffixed   → optional number
  },
});
```

A meta field is declared as a scalar keyword (`"string"`, `"number"`,
`"boolean"`, `?`-suffixed when optional) or an enum of string literals. The
contract itself is proven at construction, so a malformed one fails fast.

## Kinds

The schema validates one kind at a time: `contract` (a well-formed contract
— the kind `defineSchema` proves its own base against, and the gate for
contract data that arrives at runtime), `scope` / `role` (a declared
member), `scopes` / `roles` (a list drawn from the vocabulary), `meta` (a
construction matching the declarations — required members present, no
strays, each value ruled by its field), and `user` (the full user shape,
with grants and meta ruled by the contract).

## The bundle

`defineSchema(contract)` returns a `Schema<C>`:

- `base` — the source contract.
- `enums` — the derived vocabulary sets.
- `rules` — the rule list per kind.
- `check` — boolean type predicates per kind; `true` narrows the value.
- `assert` — throwing assertions per kind; on failure throws a `SchemaError`
  carrying every `Issue` found (not just the first).
- `parse` — asserts and returns the value narrowed — the gate for foreign
  values at a trust boundary.
- `inspect` — the non-throwing analog of `parse`: returns a `Result`
  (`{ success: true, data }` | `{ success: false, issues }`).

```ts
const candidate = await res.json();

schema.check.user(candidate); // boolean, narrows on true
schema.assert.user(candidate); // throws SchemaError with every issue
const user = schema.parse.user(candidate); // user.meta.plan: "free" | "pro"
const result = schema.inspect.user(candidate); // { success, ... }
```

An issue carries a stable `code`, a human-readable `message`, and the `path`
to the failing member (`meta.plan: plan is not declared by the contract.`).

## Types

- `User<Meta>` — the fixed user shape. (The `Provider` interaction contract
  lives in [`@letters-patent/kit`](../kit).)
- `Contract` / `Field` — the static configuration and one meta field
  declaration.
- `Scope<C>` / `Role<C>` / `Meta<C>` — the vocabulary types derived from a
  contract.
- `Schema<C>` — the bundle `defineSchema` returns; `Check<C>` / `Assert<C>`
  / `Parse<C>` / `Inspect<C>` are its per-kind families.
- `Domain<C>` — every kind mapped to the type it narrows to; `Kind` is its
  key.
- `Issue` / `Code` — a validation failure and its stable discriminant.
- `Rule` / `Rules` — a single type-agnostic rule and the per-kind rule
  lists.
- `Result<V>` — an `inspect` outcome.
- `SchemaError` — the error `assert` and `parse` throw, carrying the
  concrete `Issue`s.
