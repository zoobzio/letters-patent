<script setup lang="ts">
/**
 * Guarded by a scope: the page needs `docs:read`; the edit button needs
 * `docs:write`. Both literals are the resource document's own — a typo
 * fails to compile.
 */
definePageMeta({
  middleware: "auth",
  auth: { scopes: ["docs:read"] },
});

const auth = useAuth();
</script>

<template>
  <h1>Docs</h1>
  <p>You hold <code>docs:read</code>, so you can see this.</p>
  <button v-if="auth.can('docs:write')" type="button">Edit document</button>
  <p v-else class="muted">
    Editing needs <code>docs:write</code>, which you do not hold.
  </p>
</template>
