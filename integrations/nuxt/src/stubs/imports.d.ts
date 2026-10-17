// Typecheck-only stub for the Nuxt `#imports` virtual module.
import type { ComputedRef, Ref } from "vue";

export declare function useState<T>(key: string, init: () => T): Ref<T>;

export declare function computed<T>(getter: () => T): ComputedRef<T>;

export declare function useRequestFetch(): (
  url: string,
  options?: { method: "POST"; body?: unknown },
) => Promise<unknown>;
