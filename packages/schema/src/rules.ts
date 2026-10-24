import type { Contract, Enum, Rule, Rules } from "./types";

import { entries } from "objectively";

import { CONTRACT_KEYS, REQUIRED_USER_KEYS } from "./constant";
import {
  absent,
  at,
  container,
  each,
  field,
  filled,
  flag,
  list,
  member,
  numeric,
  optional,
  spec,
  subset,
  superset,
  text,
  unique,
} from "./util";

/**
 * Composes a contract's runtime {@link Rules}: a list per kind, with
 * membership read off the contract's sets and the meta struct read off its
 * field declarations. The composite kinds reuse the scalar lists, so every
 * issue carries the path down to the member that failed. The contract kind
 * alone is static — a contract's shape does not depend on a contract — and
 * is what {@link defineSchema} proves its own base against.
 */
export const defineRules = <C extends Contract>(
  base: C,
  enums: Enum<C>,
): Rules => {
  /** A declared vocabulary: a list of non-empty, unique names. */
  const vocabulary = (name: string, plural: string): Rule[] => [
    list(plural, [text(name), filled(name)]),
    unique(plural),
  ];

  const contract = [
    container("Contract"),
    superset("Contract", CONTRACT_KEYS),
    at("scopes", vocabulary("Scope", "Scopes")),
    at("roles", vocabulary("Role", "Roles")),
    at("groups", vocabulary("Group", "Groups")),
    at("entitlements", vocabulary("Entitlement", "Entitlements")),
    at("meta", [container("Meta"), each([spec("Meta field")])]),
  ];

  const scope = [text("Scope"), member("Scope", enums.scopes)];
  const role = [text("Role"), member("Role", enums.roles)];
  const group = [text("Group"), member("Group", enums.groups)];
  const entitlement = [
    text("Entitlement"),
    member("Entitlement", enums.entitlements),
  ];

  const identity = [
    container("User"),
    superset("User", REQUIRED_USER_KEYS),
    at("sub", [text("Subject"), filled("Subject")]),
    at("email", optional([text("Email")])),
    at("email_verified", optional([flag("Email verification")])),
    at("name", optional([text("Name")])),
    at("preferred_username", optional([text("Preferred username")])),
    at("picture", optional([text("Picture")])),
    at("iat", optional([numeric("Issued at")])),
    at("exp", optional([numeric("Expiration")])),
  ];

  const required = entries(base.meta)
    .filter(([, declared]) => !absent(declared))
    .map(([key]) => key);

  const meta = [
    container("Meta"),
    subset("Meta", enums.meta),
    superset("Meta", required),
    ...entries(base.meta).map(([key, declared]) =>
      at(key, [field(key, declared)]),
    ),
  ];

  return {
    contract,
    scope,
    role,
    group,
    entitlement,
    scopes: [list("Scopes", scope)],
    roles: [list("Roles", role)],
    groups: [list("Groups", group)],
    entitlements: [list("Entitlements", entitlement)],
    meta,
    user: [
      ...identity,
      at("scopes", optional([list("Scopes", scope)])),
      at("roles", optional([list("Roles", role)])),
      at("groups", optional([list("Groups", group)])),
      at("entitlements", optional([list("Entitlements", entitlement)])),
      at("meta", meta),
    ],
  };
};
