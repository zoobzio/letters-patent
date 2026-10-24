<script setup lang="ts">
import { manifest } from "#build/letters-patent/manifest.mjs";
import google from "#build/letters-patent/issuers/google.mjs";

/**
 * The overview: the contract the kit built from the documents of the
 * patents example, what the signed-in user holds of it, and what the kit
 * learned about the issuer.
 */
const user = useUser();
const held = (list: readonly string[] | undefined) => list ?? [];
</script>

<template>
  <h1>Acme</h1>
  <p>
    A Nuxt app over a contract built by <code>patent build</code> from an RFC
    9728 resource document, an OpenID Connect claims request, and Google's
    discovery document. Sign in as a demo account to see the checks change.
  </p>

  <h2>The contract</h2>
  <p v-if="user" class="muted">
    Bold entries are the ones {{ user.name }} holds.
  </p>
  <p v-else class="muted">Nobody is signed in, so nothing is held.</p>
  <div class="cards">
    <Vocabulary
      title="Scopes"
      :entries="manifest.scopes"
      :held="held(user?.scopes)"
    />
    <Vocabulary
      title="Roles"
      :entries="manifest.roles"
      :held="held(user?.roles)"
    />
    <Vocabulary
      title="Groups"
      :entries="manifest.groups"
      :held="held(user?.groups)"
    />
    <Vocabulary
      title="Entitlements"
      :entries="manifest.entitlements"
      :held="held(user?.entitlements)"
    />
  </div>

  <h2>The issuer</h2>
  <section class="card">
    <h3>
      <code>{{ google.issuer }}</code>
    </h3>
    <ul>
      <li>
        authorize: <code>{{ google.endpoints.authorize }}</code>
      </li>
      <li>
        token: <code>{{ google.endpoints.token }}</code>
      </li>
      <li>
        capabilities:
        <code
          v-for="(on, cap) in google.caps"
          :key="cap"
          :class="on ? '' : 'muted'"
        >
          {{ cap }}={{ on }}
        </code>
      </li>
      <li>
        publishes:
        <code v-for="claim in google.claims" :key="claim">{{ claim }}</code>
      </li>
    </ul>
    <p class="muted">
      Google publishes none of the app's roles, groups, entitlements, plan, or
      workspace — the build said so — so the server's bridge supplies them from
      the app's own records.
    </p>
  </section>
</template>
