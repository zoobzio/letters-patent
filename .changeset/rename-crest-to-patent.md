---
"letters-patent": patch
"@letters-patent/core": patch
"@letters-patent/nuxt": patch
---

Rename the service to the letters-patent domain: `defineCrest` is now
`definePatent` and the `Crest<C>` type is now `Patent<C>`. The surface is
otherwise unchanged — `current`, `can`/`is`, the lifecycle, and events all
carry over.
