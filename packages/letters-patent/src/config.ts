import type { Contract } from "@letters-patent/schema";

/**
 * Declare the app's contract in one place — a `shared/contract.ts`, a
 * `nuxt.config` — with the vocabulary intact. The helper is an identity:
 * the contract stays the plain, serializable data every consumer expects,
 * but the `const` type parameter pins its literals without an `as const`
 * at the call site, and a malformed declaration fails to compile where it
 * is written rather than where it is consumed.
 *
 * Validation is not this helper's job: the contract is proven wherever a
 * schema is derived from it (`defineSchema`, the Nuxt module's build step).
 */
export const defineLettersPatentConfig = <const C extends Contract>(
  config: C,
): C => config;
