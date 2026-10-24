import type { Check, Contract, Domain, Kind, Rule, Rules } from "./types";

/**
 * Builds the {@link Check} bundle: one boolean type predicate per kind. A
 * kind passes when every rule in its list returns no issue.
 */
export const defineCheck = <C extends Contract>(rules: Rules): Check<C> => {
  const check =
    <K extends Kind>(list: Rule[]) =>
    (v: unknown): v is Domain<C>[K] =>
      list.every((rule) => rule(v) === undefined);
  return {
    contract: check<"contract">(rules.contract),
    scope: check<"scope">(rules.scope),
    role: check<"role">(rules.role),
    group: check<"group">(rules.group),
    entitlement: check<"entitlement">(rules.entitlement),
    scopes: check<"scopes">(rules.scopes),
    roles: check<"roles">(rules.roles),
    groups: check<"groups">(rules.groups),
    entitlements: check<"entitlements">(rules.entitlements),
    meta: check<"meta">(rules.meta),
    user: check<"user">(rules.user),
  };
};
