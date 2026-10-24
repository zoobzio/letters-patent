<script setup lang="ts">
const auth = useAuth();
const user = useUser();

const signOut = async () => {
  await auth.logout();
  await navigateTo("/");
};
</script>

<template>
  <div class="page">
    <header class="bar">
      <nav>
        <NuxtLink to="/">Acme</NuxtLink>
        <NuxtLink to="/docs">Docs</NuxtLink>
        <NuxtLink to="/billing">Billing</NuxtLink>
        <NuxtLink to="/labs">Labs</NuxtLink>
      </nav>
      <div class="who">
        <template v-if="user">
          <span>
            {{ user.name ?? user.sub }}
            <span class="muted"
              >· {{ user.meta.workspace }} · {{ user.meta.plan }}</span
            >
          </span>
          <button type="button" @click="signOut">Sign out</button>
        </template>
        <NuxtLink v-else class="button" to="/login">Sign in</NuxtLink>
      </div>
    </header>
    <main>
      <NuxtPage />
    </main>
  </div>
</template>
