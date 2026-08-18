import type { Contract, Crest, Role, Scope } from "letters-patent";

/**
 * A page's access requirements, declared in `definePageMeta({ auth: … })`.
 * The literals come from the app's contract, so an undeclared scope or role
 * fails to compile.
 */
export interface AuthRequirements<C extends Contract> {
  /** Scopes the user must hold — all of them. */
  scopes?: readonly Scope<C>[];
  /** Roles that satisfy the page — any one of them. */
  roles?: readonly Role<C>[];
}

/**
 * The middleware's decision for a navigation.
 */
export type Verdict = "granted" | "unauthenticated" | "denied";

/**
 * Decide a navigation against the service: no user is `unauthenticated`; a
 * user missing a required scope (all must hold) or role (any suffices) is
 * `denied`. The checks run through `can`/`is`, so a shortfall emits the
 * service's `denied` event with the failed requirement.
 */
export const guard = <C extends Contract>(
  auth: Crest<C>,
  requirements?: AuthRequirements<C>,
): Verdict => {
  if (!auth.authenticated) {
    return "unauthenticated";
  }
  if (requirements?.scopes?.length && !auth.can(...requirements.scopes)) {
    return "denied";
  }
  if (requirements?.roles?.length && !auth.is(...requirements.roles)) {
    return "denied";
  }
  return "granted";
};
