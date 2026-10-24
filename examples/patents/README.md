# @letters-patent/example-patents

The Acme contract as a package: the standard documents under `src/`,
a `patent.config.ts` that points at them, and the kit build under `.dist/`.
The package exports the built modules — `./config`, `./manifest`,
`./issuers`, `./issuers/google`, `./resource.json` — so an app names it as
its preset:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@letters-patent/nuxt"],
  lettersPatent: { preset: "@letters-patent/example-patents" },
});
```

| Document                  | Standard                      | Gives                                                      |
| ------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `src/resource.json`       | RFC 9728                      | `docs:read`, `docs:write`, `billing:manage`                |
| `src/claims.json`         | OIDC Core §5.5 claims request | roles, groups, entitlements, `plan`, `workspace`, `locale` |
| `src/openapi.json`        | OpenAPI `oauth2` scheme       | scope descriptions                                         |
| `src/issuers/google.json` | OIDC Discovery, vendored      | Google's endpoints and capabilities                        |

```sh
pnpm build   # patent build → .dist/
pnpm test    # exercises the built modules and their types
```

The build warns that Google publishes none of `roles`, `groups`,
`entitlements`, `plan`, or `workspace`. The [Nuxt example](../nuxt) supplies
them from the app's own records in its bridge.
