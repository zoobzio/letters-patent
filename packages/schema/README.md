# @letters-patent/schema

The contracts letters-patent is built on: the `User<Meta>` shape and runtime
validation derived from a contract. Validation is built on rule lists over
the guards in [`objectively`](https://www.npmjs.com/package/objectively) —
everything else in the workspace sits on this package.

## The user

`User` is the JWT access token profile of RFC 9068 under its registered
claim names, with the OpenID Connect standard claims a session commonly
carries:

| Member                                                             | Standard                              |
| ------------------------------------------------------------------ | ------------------------------------- |
| `sub`                                                              | the subject; required                 |
| `email`, `email_verified`, `name`, `preferred_username`, `picture` | OpenID Connect Core §5.1              |
| `iat`, `exp`                                                       | epoch seconds                         |
| `scopes`                                                           | OAuth 2.0 `scope`, as a list          |
| `roles`, `groups`, `entitlements`                                  | RFC 9068 §2.2.3.1, from SCIM RFC 7643 |
| `meta`                                                             | the consumer-defined claims; required |

The four grant lists are optional: absent reads as none, so a user with no
`scopes` can do nothing.

## The contract

A contract is a static, serializable configuration: the four vocabularies
and how the consumer-defined meta is constructed. It is plain data — a
build writes it, a wire carries it — and it carries the vocabulary in its
types: declared inline, its literals become the `Scope`, `Role`, `Group`,
`Entitlement`, and `Meta` types by inference. [`@letters-patent/kit`](../kit)
builds one from the standard documents an app already has.

```ts
import { defineSchema } from "@letters-patent/schema";

const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["admin", "editor"],
  groups: ["eng", "sales"],
  entitlements: ["beta"],
  meta: {
    plan: ["free", "pro"], // enum             → "free" | "pro"
    org: "string", //                          → string
    age: "number?", // ?-suffixed              → optional number
    tags: "string[]?", // multi-valued         → optional string[]
    tier: { values: [1, 2, 3], optional: true }, // choice → optional 1 | 2 | 3
  },
});
```

A meta field is declared as a scalar keyword (`"string"`, `"number"`,
`"boolean"`, `"string[]"`, `"number[]"`, `?`-suffixed when optional), an
enum of literals (all strings or all numbers), or a choice — `{ values,
optional }`, the form an OpenID Connect claims request lowers to. The
contract itself is proven at construction, so a malformed one fails fast.

## Kinds

The schema validates one kind at a time: `contract` (a well-formed contract
— the kind `defineSchema` proves its own base against, and the gate for
contract data that arrives at runtime), `scope` / `role` / `group` /
`entitlement` (a declared member), `scopes` / `roles` / `groups` /
`entitlements` (a list drawn from the vocabulary), `meta` (a construction
matching the declarations — required members present, no strays, each
value ruled by its field), and `user` (the full user shape, with grants and
meta ruled by the contract).

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
  lives in [`@letters-patent/sdk`](../sdk).)
- `Contract` / `Field` — the static configuration and one meta field
  declaration; `Keyword`, `Literals`, and `Choice` are its forms.
- `Scope<C>` / `Role<C>` / `Group<C>` / `Entitlement<C>` / `Meta<C>` — the
  vocabulary types derived from a contract.
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
- `absent`, `keyword`, `literals` — read a `Field` declaration apart; the
  kit and the rules share them.
