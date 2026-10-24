<script setup lang="ts">
/**
 * One vocabulary of the contract as the manifest describes it, with what
 * the current user holds of it marked. The entries come from the kit build
 * — ids, titled names, and the descriptions the documents carry.
 */
defineProps<{
  title: string;
  entries: readonly { id: string; name: string; description?: string }[];
  held: readonly string[];
}>();
</script>

<template>
  <section class="card">
    <h3>{{ title }}</h3>
    <ul>
      <li
        v-for="entry in entries"
        :key="entry.id"
        :class="held.includes(entry.id) ? 'held' : 'missing'"
        :title="entry.description"
      >
        <code>{{ entry.id }}</code>
        <span v-if="entry.description" class="muted">
          — {{ entry.description }}</span
        >
      </li>
    </ul>
  </section>
</template>
