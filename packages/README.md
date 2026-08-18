# Packages

| Package                         | Directory            | Description                                                          |
| ------------------------------- | -------------------- | -------------------------------------------------------------------- |
| [`letters-patent`](./letters-patent)      | `packages/letters-patent` | Umbrella package — core API at the root, `kit` and `config` subpaths |
| [`@letters-patent/core`](./core)     | `packages/core`      | The service runtime (`defineCrest`)                                  |
| [`@letters-patent/kit`](./kit)       | `packages/kit`       | Provider toolkit (`defineProvider`, `defineState`)                   |
| [`@letters-patent/schema`](./schema) | `packages/schema`    | The `User`/`Provider` contracts and runtime validation               |

Auth-provider and framework integrations live in
[`../integrations`](../integrations).
