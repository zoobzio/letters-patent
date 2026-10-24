import type {
  Contract,
  Entitlement,
  Group,
  Patent,
  Role,
  Scope,
} from "letters-patent";

/**
 * A page's access requirements, declared in `definePageMeta({ auth: … })`.
 * The literals come from the app's contract, so an undeclared member fails
 * to compile.
 */
export interface AuthRequirements<C extends Contract> {
  /** Scopes the user must hold — all of them. */
  scopes?: readonly Scope<C>[];
  /** Roles that satisfy the page — any one of them. */
  roles?: readonly Role<C>[];
  /** Groups that satisfy the page — any one of them. */
  groups?: readonly Group<C>[];
  /** Entitlements that satisfy the page — any one of them. */
  entitlements?: readonly Entitlement<C>[];
}

/**
 * The middleware's decision for a navigation.
 */
export type Verdict = "granted" | "unauthenticated" | "denied";

/**
 * Decide a navigation against the service: no user is `unauthenticated`; a
 * user missing a required scope (all must hold), or holding none of the
 * listed roles, groups, or entitlements (any suffices), is `denied`. The
 * checks run through `can`/`is`/`in`/`has`, so a shortfall emits the
 * service's `denied` event with the failed requirement.
 */
export const guard = <C extends Contract>(
  auth: Patent<C>,
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
  if (requirements?.groups?.length && !auth.in(...requirements.groups)) {
    return "denied";
  }
  if (
    requirements?.entitlements?.length &&
    !auth.has(...requirements.entitlements)
  ) {
    return "denied";
  }
  return "granted";
};
