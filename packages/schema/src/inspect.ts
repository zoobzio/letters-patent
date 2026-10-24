import type { Contract, Inspect, Parse, Result } from "./types";

import { SchemaError } from "./error";

/**
 * Builds the {@link Inspect} bundle: each kind runs its {@link Parse} and
 * captures the outcome as a {@link Result} instead of throwing — success
 * with the narrowed value, failure with the issues. Any
 * non-{@link SchemaError} propagates.
 */
export const defineInspect = <C extends Contract>(
  parse: Parse<C>,
): Inspect<C> => {
  const inspect =
    <V>(parseFn: (v: unknown) => V) =>
    (v: unknown): Result<V> => {
      try {
        return { success: true, data: parseFn(v) };
      } catch (error) {
        if (error instanceof SchemaError) {
          return { success: false, issues: error.issues };
        }
        throw error;
      }
    };
  return {
    contract: inspect(parse.contract),
    scope: inspect(parse.scope),
    role: inspect(parse.role),
    group: inspect(parse.group),
    entitlement: inspect(parse.entitlement),
    scopes: inspect(parse.scopes),
    roles: inspect(parse.roles),
    groups: inspect(parse.groups),
    entitlements: inspect(parse.entitlements),
    meta: inspect(parse.meta),
    user: inspect(parse.user),
  };
};
