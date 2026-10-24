import type {
  Assert,
  Contract,
  Entitlement,
  Group,
  Issue,
  Meta,
  Role,
  Rule,
  Rules,
  Scope,
  User,
} from "./types";

import { SchemaError } from "./error";

/**
 * Builds the {@link Assert} bundle: each kind runs every rule, collects all
 * the {@link Issue}s, and throws a {@link SchemaError} if any were found.
 */
export const defineAssert = <C extends Contract>(rules: Rules): Assert<C> => {
  const run = (v: unknown, list: Rule[]): void => {
    const issues = list.reduce<Issue[]>((acc, rule) => {
      const issue = rule(v);
      if (issue) {
        acc.push(issue);
      }
      return acc;
    }, []);
    if (issues.length > 0) {
      throw new SchemaError(issues);
    }
  };
  return {
    contract: (v: unknown): asserts v is Contract => run(v, rules.contract),
    scope: (v: unknown): asserts v is Scope<C> => run(v, rules.scope),
    role: (v: unknown): asserts v is Role<C> => run(v, rules.role),
    group: (v: unknown): asserts v is Group<C> => run(v, rules.group),
    entitlement: (v: unknown): asserts v is Entitlement<C> =>
      run(v, rules.entitlement),
    scopes: (v: unknown): asserts v is Scope<C>[] => run(v, rules.scopes),
    roles: (v: unknown): asserts v is Role<C>[] => run(v, rules.roles),
    groups: (v: unknown): asserts v is Group<C>[] => run(v, rules.groups),
    entitlements: (v: unknown): asserts v is Entitlement<C>[] =>
      run(v, rules.entitlements),
    meta: (v: unknown): asserts v is Meta<C> => run(v, rules.meta),
    user: (v: unknown): asserts v is User<Meta<C>> => run(v, rules.user),
  };
};
