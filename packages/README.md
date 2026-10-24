# Packages

| Package                              | Directory                 | Description                                                          |
| ------------------------------------ | ------------------------- | -------------------------------------------------------------------- |
| [`letters-patent`](./letters-patent) | `packages/letters-patent` | Umbrella package — core API at the root, `sdk` and `config` subpaths |
| [`@letters-patent/core`](./core)     | `packages/core`           | The service runtime (`definePatent`)                                 |
| [`@letters-patent/sdk`](./sdk)       | `packages/sdk`            | Provider SDK (`defineProvider`, `defineState`)                       |
| [`@letters-patent/schema`](./schema) | `packages/schema`         | The `User`/`Provider` contracts and runtime validation               |

Auth-provider and framework integrations live in
[`../integrations`](../integrations).
