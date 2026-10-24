# @letters-patent/core

## 0.0.2

### Patch Changes

- [`d98f39a`](https://github.com/zoobzio/letters-patent/commit/d98f39aeaf9b61224ec187295484da4b95f3a8b5) Thanks [@zoobzio](https://github.com/zoobzio)! - Rename the service to the letters-patent domain: `defineCrest` is now
  `definePatent` and the `Crest<C>` type is now `Patent<C>`. The surface is
  otherwise unchanged — `current`, `can`/`is`, the lifecycle, and events all
  carry over.

- [`5f851f9`](https://github.com/zoobzio/letters-patent/commit/5f851f9b31dfadad0cbf3ba2d586d5c54b04c729) Thanks [@zoobzio](https://github.com/zoobzio)! - Rename the provider-authoring package from `@letters-patent/kit` to
  `@letters-patent/sdk`. The umbrella subpath moves with it: import
  `defineProvider`, `defineState` and the `Provider<C>` types from
  `letters-patent/sdk` instead of `letters-patent/kit`.

- [`39e11fd`](https://github.com/zoobzio/letters-patent/commit/39e11fdfa3a7eb8fa86ffdbbcfeb510364362662) Thanks [@zoobzio](https://github.com/zoobzio)! - Build the contract from the standards, and shape the user after them.

  - `@letters-patent/kit` (new): `patent build` reads an app's OAuth 2.0
    Protected Resource Metadata (RFC 9728), an OpenID Connect claims request
    (Core §5.5), and each issuer's discovery document (RFC 8414), assembles and
    proves the contract, and writes the
    typed modules the runtime consumes: the vocabulary unions and guards, the
    contract and its `Contract` type, a manifest, one module per issuer with
    its endpoints, capabilities, and `Claims` type, and `resource.json` ready
    to serve at `/.well-known/oauth-protected-resource`. It warns about what
    the documents cannot settle — a claim the issuer does not publish, an
    issuer without PKCE or refresh — and fails on a malformed document.
  - `@letters-patent/schema`: the contract declares four vocabularies —
    `scopes`, `roles`, `groups`, `entitlements` — the authorization claims of
    RFC 9068 §2.2.3.1. `User` takes the registered claim names: `sub`,
    `email_verified`, `preferred_username`, `picture`, `iat`, `exp` (epoch
    seconds) replace `id`, `verified`, `username`, `avatar`, `issued`,
    `expires`; `status` is gone; the four grant lists are optional and read
    as none when absent. A meta field may be multi-valued (`"string[]"`,
    `"number[]"`), a numeric enum, or a choice (`{ values, optional }`).
  - `@letters-patent/core`: `in(...groups)` and `has(...entitlements)` join
    `can` and `is`; `denied` reports `group` and `entitlement` checks; `stale`
    reads `exp` in seconds.
  - `@letters-patent/nuxt`: the module builds the contract from
    `patent.config.ts` with the kit, forwards a `preset` package's kit build,
    or takes a contract inline, and writes the same modules the CLI writes
    under `#build/letters-patent/`; the `auth` page-meta accepts `groups` and
    `entitlements`.
  - `@letters-patent/google`: the provider sets `iat` and `exp` in seconds.

- Updated dependencies [[`9fedc1d`](https://github.com/zoobzio/letters-patent/commit/9fedc1d9e8fa3378a1140cee4f64d69d1d6ce4fb), [`5f851f9`](https://github.com/zoobzio/letters-patent/commit/5f851f9b31dfadad0cbf3ba2d586d5c54b04c729), [`39e11fd`](https://github.com/zoobzio/letters-patent/commit/39e11fdfa3a7eb8fa86ffdbbcfeb510364362662)]:
  - @letters-patent/sdk@0.0.2
  - @letters-patent/schema@0.0.2

## 0.0.1

### Patch Changes

- [`ed4a1dd`](https://github.com/zoobzio/letters-patent/commit/ed4a1dd92acd075d9b631b405f3717e372ca8c4e) Thanks [@zoobzio](https://github.com/zoobzio)! - initial release

- Updated dependencies [[`ed4a1dd`](https://github.com/zoobzio/letters-patent/commit/ed4a1dd92acd075d9b631b405f3717e372ca8c4e)]:
  - @letters-patent/kit@0.0.1
  - @letters-patent/schema@0.0.1
