# @letters-patent/nuxt

Nuxt module for letters-patent with SSR. It provides an `$auth` service resolved
on the server and hydrated on the client, the `useAuth()` and `useUser()`
composables, and the `defineAuthHandlers` server helper — all typed by the
app's own contract.

## Setup

Declare your contract once and add the module:

```ts
// shared/contract.ts
import { defineLettersPatentConfig } from "letters-patent/config";

export const contract = defineLettersPatentConfig({
  scopes: ["docs:read", "docs:write"],
  roles: ["admin", "editor"],
  meta: { plan: ["free", "pro"] },
});

// nuxt.config.ts
import { contract } from "./shared/contract";

export default defineNuxtConfig({
  modules: ["@letters-patent/nuxt"],
  lettersPatent: { contract },
});
```

Write your provider (a set of callbacks over letters-patent's own domain objects
— the h3 event is its own domain, closed over per request), then hand it to
`defineAuthHandlers` in one server route file:

```ts
// server/api/auth/[action].ts
import { defineSchema } from "letters-patent";
import { contract } from "../../../shared/contract";
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

`can`/`is` carry the contract's vocabulary in their types — an undeclared
scope fails to compile in the app.

## Protecting pages

The module registers a named `auth` route middleware. Opt in per page, and
declare the page's requirements — scopes must all hold, any listed role
suffices — in the same vocabulary:

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
typed by the contract, so an undeclared scope or role fails to compile.

## Options

| Option     | Default       | Description                                                                                                                                           |
| ---------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contract` | — (required)  | The app's contract: scopes, roles, and meta.                                                                                                          |
| `prefix`   | `"/api/auth"` | The route prefix the auth endpoints live under. The handler file must sit at the matching Nitro path (`server/api/auth/[action].ts` for the default). |
| `login`    | `"/login"`    | The route the `auth` middleware sends unauthenticated visitors to, with the attempted path as a `redirect` query parameter.                           |

## How it works

- At build time the module proves the configured contract, writes it and the
  route prefix to the `#build/letters-patent.mjs` template, and derives the
  `AppContract` literal type — so both sides of the wire share one
  vocabulary and the app surface is fully typed.
- The runtime plugin derives the schema from the build contract, builds the
  service over a `useState` container and, on the server only, resolves the
  user so state populates before render and serializes to the client — no
  refetch or auth flash on hydration.
- The module's transport is itself a provider whose vendor is the app's own
  auth routes: every callback dials `${prefix}/*`, and each answer is proven
  against the schema before it lands in state.
- The user's provider runs only inside the server handlers, constructed per
  request with the h3 event; the auth host never reaches the browser.
