---
"@crestable/nuxt": patch
---

Rename the app-facing surface to auth-domain names and add route protection.

- `useCrest()` is now `useAuth()`, and the injected service is `$auth`
  (was `$crestable`); a new `useUser()` composable exposes the current
  user as a reactive ref.
- The server helper `defineCrestHandlers` is now `defineAuthHandlers`.
- The auth endpoints' route prefix is configurable via the module's
  `prefix` option and defaults to `/api/auth` (was the hardcoded
  `/api/_crestable`); the handler route file moves to the matching Nitro
  path, e.g. `server/api/auth/[action].ts`.
- New named `auth` route middleware: opt in with
  `definePageMeta({ middleware: "auth" })` and declare contract-typed
  requirements via `definePageMeta({ auth: { scopes, roles } })`.
  Unauthenticated visitors are redirected to the `login` option's route
  (default `/login`) with the attempted path in the `redirect` query
  parameter; authenticated users that fall short of the requirements get
  a 403.
