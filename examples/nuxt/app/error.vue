<script setup lang="ts">
import type { NuxtError } from "#app";

defineProps<{ error: NuxtError }>();
</script>

<template>
  <div class="page">
    <h1>{{ error.statusCode }}</h1>
    <p v-if="error.statusCode === 403">
      You are signed in, but you do not hold what this page requires. The
      service's <code>denied</code> event fired with the failed check.
    </p>
    <p v-else>{{ error.statusMessage }}</p>
    <p><NuxtLink class="button" to="/">Back to the overview</NuxtLink></p>
  </div>
</template>
