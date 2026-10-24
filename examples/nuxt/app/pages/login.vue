<script setup lang="ts">
import { accounts } from "#shared/accounts";

/**
 * The stubbed sign-in: a list of demo accounts. Each link is a top-level
 * navigation to the login action with the account to sign in as, the way
 * a real provider's login navigates to the issuer. The server establishes
 * the session and sends the browser on to the attempted page.
 */
const route = useRoute();
const redirect =
  typeof route.query.redirect === "string" ? route.query.redirect : "/";
const href = (sub: string) =>
  `/api/auth/login?${new URLSearchParams({ as: sub, redirect })}`;
</script>

<template>
  <h1>Sign in</h1>
  <p class="muted">
    Authentication is stubbed: pick an account and the server holds it in a
    cookie. A real app would send the browser to Google here.
  </p>
  <div class="accounts">
    <section v-for="account in accounts" :key="account.claims.sub" class="card">
      <h3>{{ account.claims.name }}</h3>
      <p class="muted">{{ account.claims.email }}</p>
      <ul>
        <li>
          roles: <code>{{ account.roles.join(", ") || "none" }}</code>
        </li>
        <li>
          scopes: <code>{{ account.scopes.join(", ") || "none" }}</code>
        </li>
        <li>
          plan: <code>{{ account.plan }}</code>
        </li>
      </ul>
      <p>
        <a class="button" :href="href(account.claims.sub)"
          >Sign in as {{ account.claims.name }}</a
        >
      </p>
    </section>
  </div>
</template>
