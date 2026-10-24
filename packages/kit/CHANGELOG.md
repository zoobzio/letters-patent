# @letters-patent/kit

## 0.0.2

### Patch Changes

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

- Updated dependencies [[`39e11fd`](https://github.com/zoobzio/letters-patent/commit/39e11fdfa3a7eb8fa86ffdbbcfeb510364362662)]:
  - @letters-patent/schema@0.0.2
