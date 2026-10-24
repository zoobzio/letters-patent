---
"@letters-patent/sdk": patch
"letters-patent": patch
"@letters-patent/core": patch
---

Rename the provider-authoring package from `@letters-patent/kit` to
`@letters-patent/sdk`. The umbrella subpath moves with it: import
`defineProvider`, `defineState` and the `Provider<C>` types from
`letters-patent/sdk` instead of `letters-patent/kit`.
