# @letters-patent/nuxt

Nuxt module for letters-patent with SSR. It provides an `$auth` service resolved
on the server and hydrated on the client, the `useAuth()` and `useUser()`
composables, and the `defineAuthHandlers` server helper — all typed by the
app's own contract.

## Setup

Point the module at the kit config that builds your contract and add the
module. The module builds the contract in memory with
[`@letters-patent/kit`](../../packages/kit) and watches the config and
every document it read.

```ts
// patent.config.ts
import { defineConfig } from "@letters-patent/kit";

export default defineConfig({
  resource: "./auth/resource.json",
  claims: "./auth/claims.json",
  issuers: { google: "./auth/issuers/google.json" },
});

// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@letters-patent/nuxt"],
});
```

An app whose contract is built elsewhere names the package that exports
the kit build — its `./config`, `./manifest`, `./issuers`, and
`./issuers/<id>` — as its preset. The module re-exports the package's
modules; the package is a dependency of the app.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@letters-patent/nuxt"],
  lettersPatent: { preset: "@acme/patents" },
});
```

An app without the documents declares the contract inline instead:

```ts
// nuxt.config.ts
import { defineLettersPatentConfig } from "letters-patent/config";

export default defineNuxtConfig({
  modules: ["@letters-patent/nuxt"],
  lettersPatent: {
    contract: defineLettersPatentConfig({
      scopes: ["docs:read", "docs:write"],
      roles: ["admin", "editor"],
      groups: [],
      entitlements: [],
      meta: { plan: ["free", "pro"] },
    }),
  },
});
```

Write your provider (a set of callbacks over letters-patent's own domain objects
— the h3 event is its own domain, closed over per request), then hand it to
`defineAuthHandlers` in one server route file:

```ts
// server/api/auth/[action].ts
import { defineSchema } from "letters-patent";
import { contract } from "#build/letters-patent.mjs";
import { createMyProvider } from "../../providers/auth";

const schema = defineSchema(contract);

export default defineAuthHandlers(schema, (event) =>
  createMyProvider(schema, { event }, (claims) => ({ ... })),
);
```

That's the whole wiring. The browser-side transport that calls these routes
ships with the module.

## Usage

```vue
<script setup lang="ts">
const auth = useAuth();
const user = useUser(); // reactive User | null, shorthand for auth.current
</script>

<template>
  <p v-if="auth.authenticated">Hi, {{ user?.id }}</p>
  <button v-if="auth.can('docs:write')">Edit</button>
</template>
```

`can`/`is`/`in`/`has` carry the contract's vocabulary in their types — an
undeclared scope fails to compile in the app.

## Redirect-based providers

A provider that leaves the app for its auth host — Google, any OAuth or
OpenID Connect service — returns a continuation from `login` and completes
the flow in `callback`. The handlers serve both:

- `auth.login()` from a component POSTs to `${prefix}/login`; the handler
  answers with the location as data and the transport navigates the browser
  there. State is untouched until the flow returns.
- A plain link or `navigateTo(..., { external: true })` to
  `${prefix}/login?redirect=/editor` works too: a navigating browser is sent
  on with a 302, and `redirect` names the in-app path to land on afterwards
  (an off-site value is ignored). The `auth` middleware already leaves the
  attempted path in the login page's `redirect` query parameter to pass on.
- The auth host sends the browser back to `${prefix}/callback`, which the
  provider's redirect URI must name — `https://app.example/api/auth/callback`
  for the default prefix. The handler establishes the session and 302s to
  the path the provider names.

With [`@letters-patent/google`](../../providers/google):

```ts
// server/api/auth/[action].ts
import { defineSchema } from "letters-patent";
import { createGoogleProvider } from "@letters-patent/google";
import { contract } from "../../../shared/contract";

const schema = defineSchema(contract);

export default defineAuthHandlers(schema, (event) => {
  const config = useRuntimeConfig(event);
  return createGoogleProvider(
    schema,
    {
      event,
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      redirectUri: `${config.public.origin}/api/auth/callback`,
      secret: config.sessionSecret,
    },
    async (claims) => {
      const account = await findAccount(claims.sub);
      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        avatar: claims.picture,
        scopes: account?.scopes ?? [],
        roles: account?.roles ?? [],
        meta: { plan: account?.plan ?? "free" },
      };
    },
  );
});
```

## Protecting pages

The module registers a named `auth` route middleware. Opt in per page, and
declare the page's requirements — scopes must all hold; any listed role,
group, or entitlement suffices — in the same vocabulary:

```vue
<script setup lang="ts">
definePageMeta({
  middleware: "auth",
  auth: { scopes: ["docs:write"], roles: ["editor"] },
});
</script>
```

An unauthenticated visitor is redirected to the login route (the `login`
option, `/login` by default) with the attempted path in the `redirect`
query parameter — `/login?redirect=/editor`. An authenticated user that
falls short of the requirements gets a 403 error page, and the service's
`denied` event fires with the failed check. The `auth` page-meta entry is
typed by the contract, so an undeclared member fails to compile.

## Options

| Option     | Default            | Description                                                                                                                                           |
| ---------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contract` | —                  | The app's contract, declared inline. When set, neither a preset nor the kit config is read.                                                           |
| `preset`   | —                  | A package that exports a kit build, such as one published from `patent build`. Read when `contract` is absent.                                        |
| `config`   | `patent.config.ts` | The kit config to build the contract from, relative to the project root. Read when `contract` and `preset` are absent.                                |
| `prefix`   | `"/api/auth"`      | The route prefix the auth endpoints live under. The handler file must sit at the matching Nitro path (`server/api/auth/[action].ts` for the default). |
| `login`    | `"/login"`         | The route the `auth` middleware sends unauthenticated visitors to, with the attempted path as a `redirect` query parameter.                           |

## How it works

- At build time the module resolves the contract — inline and proven,
  forwarded from the preset, or built from the kit config — and writes the
  same modules `patent build` writes under `#build/letters-patent/`: `config.mjs` with the contract and
  its `Contract` type, `index.mjs` with the vocabulary guards, `manifest.mjs`,
  and the issuers. `#build/letters-patent.mjs` re-exports the contract with
  the route prefix and login route. Both sides of the wire share one
  vocabulary and the app surface is fully typed.
- The runtime plugin derives the schema from the build contract, builds the
  service over a `useState` container and, on the server only, resolves the
  user so state populates before render and serializes to the client — no
  refetch or auth flash on hydration.
- The module's transport is itself a provider whose vendor is the app's own
  auth routes: every callback dials `${prefix}/*`, and each answer is proven
  against the schema before it lands in state. A `login` answer that is a
  continuation rather than a user sends the browser to the auth host.
- The handlers serve `session`, `login`, `callback`, `logout`, and
  `refresh`. A continuation a provider returns from `login` or `callback`
  becomes a 302 for a navigating browser (`Sec-Fetch-Mode: navigate`, or an
  `Accept` for HTML) and data for a fetch.
- The user's provider runs only inside the server handlers, constructed per
  request with the h3 event; the auth host never reaches the browser.
