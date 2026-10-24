# @letters-patent/example-nuxt

The Acme app: a Nuxt app over the contract the
[patents example](../patents) builds. The module takes the kit build from
the installed package as its preset, so every check in the app — the
`auth` page-meta, `can`/`is`/`in`/`has`, the user's `meta` — is typed by the
documents under `examples/patents/src/`.

Authentication is stubbed. The login page lists three demo accounts; a
link is a top-level navigation to `/api/auth/login?as=<sub>`, the way a
real provider's login navigates to the issuer, and the server holds the
chosen subject in an HTTP-only cookie. The bridge turns Google-shaped
claims and the app's own record into the contract's user — the roles,
groups, entitlements, plan, and workspace Google would never know.

| Page       | Guard                                         |
| ---------- | --------------------------------------------- |
| `/`        | none; shows the manifest and what you hold    |
| `/docs`    | scope `docs:read`; editing needs `docs:write` |
| `/billing` | role `admin`                                  |
| `/labs`    | entitlement `beta` and group `engineering`    |

| Account | Roles  | Scopes                                      | Plan       |
| ------- | ------ | ------------------------------------------- | ---------- |
| Ada     | editor | `docs:read`, `docs:write`                   | team       |
| Grace   | admin  | `docs:read`, `docs:write`, `billing:manage` | enterprise |
| Guest   | viewer | `docs:read`                                 | free       |

## Run

From the repo root:

```sh
pnpm install
pnpm build
pnpm --filter @letters-patent/example-nuxt dev
```

Other scripts: `build`, `preview`, `typecheck`, `test`. The test mounts the
auth handlers on a plain h3 app and drives the stubbed provider over HTTP.

## Wiring

- `nuxt.config.ts` names the preset. The module writes the preset's modules
  under `#build/letters-patent/`; the overview page imports the manifest
  and the Google issuer module from there.
- `server/api/auth/[action].ts` hands the stubbed provider to
  `defineAuthHandlers`. `server/utils/demo.ts` is the provider and the
  bridge; `shared/accounts.ts` the demo accounts, shared with the login
  page.
- The pages declare their requirements in `definePageMeta({ auth })`, in
  the contract's vocabulary.
