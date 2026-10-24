import type { Contract } from "@letters-patent/schema";
import type { ClaimEntry, Claims, Describe, Entry, Manifest } from "./types";

import { title } from "./util";

/** Makes an entry: the id, its titled name, and a description when there is one. */
export const entry = (id: string, description?: string): Entry => {
  const found: Entry = { id, name: title(id) };
  if (description !== undefined && description !== "") {
    found.description = description;
  }
  return found;
};

/**
 * Describes a built contract for an interface that presents it: a consent
 * screen, an admin console. Each vocabulary member gets an entry with its
 * id, a titled name, and a description from the config or — for scopes —
 * the OpenAPI document. Each requested claim gets an entry with whether it
 * is essential and its literals.
 *
 * @param contract - The built contract; it sets the members and their order.
 * @param claims - The claims request, for the claim entries.
 * @param describe - Descriptions from the config.
 * @param scopes - Scope descriptions from an OpenAPI document.
 */
export const describe = (
  contract: Contract,
  claims?: Claims,
  describe: Describe = {},
  scopes: Record<string, string> = {},
): Manifest => {
  const vocabulary = (
    members: readonly string[],
    described: Record<string, string> = {},
    fallback: Record<string, string> = {},
  ): Entry[] => members.map((id) => entry(id, described[id] ?? fallback[id]));

  const requested: ClaimEntry[] = (claims?.requested ?? []).map((claim) => {
    const found: ClaimEntry = {
      ...entry(claim.name, describe.claims?.[claim.name]),
      essential: claim.essential,
    };
    if (claim.values !== undefined) {
      found.values = claim.values;
    }
    return found;
  });

  return {
    scopes: vocabulary(contract.scopes, describe.scopes, scopes),
    roles: vocabulary(contract.roles, describe.roles),
    groups: vocabulary(contract.groups, describe.groups),
    entitlements: vocabulary(contract.entitlements, describe.entitlements),
    claims: requested,
  };
};
