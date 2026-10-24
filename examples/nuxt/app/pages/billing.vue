<script setup lang="ts">
/**
 * Guarded by a role: any of the listed roles suffices. An editor holding
 * every scope still gets a 403 here.
 */
definePageMeta({
  middleware: "auth",
  auth: { roles: ["admin"] },
});

const user = useUser();
</script>

<template>
  <h1>Billing</h1>
  <p>Only an <code>admin</code> reaches this page.</p>
  <p>
    Workspace <code>{{ user?.meta.workspace }}</code> is on the
    <code>{{ user?.meta.plan }}</code> plan.
  </p>
</template>
