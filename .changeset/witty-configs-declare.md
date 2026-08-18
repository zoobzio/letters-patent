---
"crestable": patch
---

Add the `crestable/config` subpath with `defineCrestableConfig`, an identity
declaration helper: it pins the contract's literals without an `as const` at
the call site and fails a malformed declaration where it is written.
