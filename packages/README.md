# Packages

| Package                              | Directory                 | Description                                                          |
| ------------------------------------ | ------------------------- | -------------------------------------------------------------------- |
| [`letters-patent`](./letters-patent) | `packages/letters-patent` | Umbrella package — core API at the root, `sdk` and `config` subpaths |
| [`@letters-patent/core`](./core)     | `packages/core`           | The service runtime (`definePatent`)                                 |
| [`@letters-patent/kit`](./kit)       | `packages/kit`            | The build kit (`patent build`): RFC 9728 + OIDC documents → contract |
| [`@letters-patent/sdk`](./sdk)       | `packages/sdk`            | Provider SDK (`defineProvider`, `defineState`)                       |
| [`@letters-patent/schema`](./schema) | `packages/schema`         | The `User` contract and runtime validation                           |

Auth-provider and framework integrations live in
[`../integrations`](../integrations).
