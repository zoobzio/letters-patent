<script setup lang="ts">
/**
 * Guarded by an entitlement and a group: `beta` and membership of
 * `engineering`, the two vocabularies RFC 9068 adds beside roles.
 */
definePageMeta({
  middleware: "auth",
  auth: { entitlements: ["beta"], groups: ["engineering"] },
});

const auth = useAuth();
</script>

<template>
  <h1>Labs</h1>
  <p>
    You hold the <code>beta</code> entitlement and belong to
    <code>engineering</code>.
  </p>
  <p v-if="auth.has('export')">You can also export the workspace.</p>
  <p v-else class="muted">
    Exporting needs the <code>export</code> entitlement.
  </p>
</template>
