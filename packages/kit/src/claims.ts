import type { Field, Keyword } from "@letters-patent/schema";
import type { Claim, Claims } from "./types";

import { entries, record } from "objectively";

import { SECTIONS } from "./constant";
import { InvalidDocumentError } from "./error";
import {
  PROFILE_CLAIMS,
  RESERVED_CLAIMS,
  STANDARD_CLAIMS,
  UNSUPPORTED_CLAIMS,
  VOCABULARY_CLAIMS,
} from "./standard";
import { repeated } from "./util";

/**
 * Reads one claim's request: `null` for a plain request, or an object with
 * `essential`, `value`, and `values` (OIDC Core §5.5.1). A single `value`
 * is one literal in `values`.
 */
const claim = (
  name: string,
  request: unknown,
  origin: string,
  path: string[],
): Claim => {
  if (request === null) {
    return { name, essential: false };
  }
  if (!record(request)) {
    throw new InvalidDocumentError(
      origin,
      "must be null or an object with essential, value, or values",
      path,
    );
  }
  for (const key of Object.keys(request)) {
    if (!["essential", "value", "values"].includes(key)) {
      throw new InvalidDocumentError(origin, `unknown member ${key}`, path);
    }
  }
  const { essential, value, values } = request;
  if (essential !== undefined && typeof essential !== "boolean") {
    throw new InvalidDocumentError(origin, "must be a boolean", [
      ...path,
      "essential",
    ]);
  }
  if (value !== undefined && values !== undefined) {
    throw new InvalidDocumentError(
      origin,
      "declare value or values, not both",
      path,
    );
  }
  let literals: unknown[] | undefined;
  if (values !== undefined) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new InvalidDocumentError(origin, "must be a non-empty array", [
        ...path,
        "values",
      ]);
    }
    literals = values;
  } else if (value !== undefined) {
    literals = [value];
  }
  const found: Claim = { name, essential: essential ?? false };
  if (literals !== undefined) {
    const numbers = typeof literals[0] === "number";
    for (const [index, literal] of literals.entries()) {
      const ok = numbers
        ? typeof literal === "number"
        : typeof literal === "string" && literal.trim() !== "";
      if (!ok) {
        throw new InvalidDocumentError(
          origin,
          numbers
            ? "literals must all be numbers"
            : "literals must all be non-empty strings",
          [...path, values === undefined ? "value" : "values", String(index)],
        );
      }
    }
    const twice = numbers ? [] : repeated(literals as string[]);
    if (twice.length > 0) {
      throw new InvalidDocumentError(origin, `repeats ${twice.join(", ")}`, [
        ...path,
        "values",
      ]);
    }
    found.values = literals as (string | number)[];
  }
  return found;
};

/**
 * Merges the same claim requested under both sections: essential when
 * either is, and the literals must agree.
 */
const merge = (first: Claim, second: Claim, origin: string): Claim => {
  if (
    first.values !== undefined &&
    second.values !== undefined &&
    JSON.stringify(first.values) !== JSON.stringify(second.values)
  ) {
    throw new InvalidDocumentError(
      origin,
      `${first.name} declares different values under id_token and userinfo`,
    );
  }
  const merged: Claim = {
    name: first.name,
    essential: first.essential || second.essential,
  };
  const values = first.values ?? second.values;
  if (values !== undefined) {
    merged.values = values;
  }
  return merged;
};

/**
 * The meta field a requested claim lowers to: its literals as an enum —
 * the compact form when essential, a choice marked optional when not — or
 * its keyword, `?`-suffixed when not essential.
 */
export const lower = (requested: Claim, word: Keyword): Field => {
  if (requested.values !== undefined) {
    const values = requested.values as string[] | number[];
    return requested.essential ? values : { values, optional: true };
  }
  return requested.essential ? word : `${word}?`;
};

/**
 * Reads an OpenID Connect claims request (OIDC Core §5.5) apart. The
 * document has an `id_token` and/or a `userinfo` section; each maps claim
 * names to a request. The build does not distinguish where a claim is
 * delivered — the provider's bridge does — so both sections request.
 *
 * - `roles`, `groups`, `entitlements` with `values` are the vocabularies.
 * - The profile claims a `User` carries (`email`, `name`, …) are recorded
 *   for verification; they lower to nothing.
 * - Every other claim lowers to a meta field: `values` an enum, otherwise
 *   the keyword from `types`, the standard claims table, or `string`;
 *   `essential` whether the member is required.
 *
 * @param doc - The parsed JSON.
 * @param origin - Where the document came from, for error messages.
 * @param types - The keyword of a custom claim without `values`.
 */
export const parseClaims = (
  doc: unknown,
  origin: string,
  types: Record<string, Keyword> = {},
): Claims => {
  if (!record(doc)) {
    throw new InvalidDocumentError(origin, "must be a JSON object");
  }
  for (const key of Object.keys(doc)) {
    if (!(SECTIONS as readonly string[]).includes(key)) {
      throw new InvalidDocumentError(
        origin,
        `unknown section ${key}; a claims request has id_token and userinfo`,
      );
    }
  }

  const requested = new Map<string, Claim>();
  for (const section of SECTIONS) {
    const members = doc[section];
    if (members === undefined) {
      continue;
    }
    if (!record(members)) {
      throw new InvalidDocumentError(origin, "must be an object of claims", [
        section,
      ]);
    }
    for (const [name, request] of entries(members)) {
      const found = claim(name, request, origin, [section, name]);
      const prior = requested.get(name);
      requested.set(name, prior ? merge(prior, found, origin) : found);
    }
  }

  const claims: Claims = {
    requested: [...requested.values()],
    roles: [],
    groups: [],
    entitlements: [],
    profile: [],
    meta: {},
  };

  for (const found of claims.requested) {
    const { name } = found;
    if (name in RESERVED_CLAIMS) {
      throw new InvalidDocumentError(
        origin,
        `${name} cannot be requested: ${RESERVED_CLAIMS[name]}`,
      );
    }
    if (name in UNSUPPORTED_CLAIMS) {
      throw new InvalidDocumentError(
        origin,
        `${name} is not supported: ${UNSUPPORTED_CLAIMS[name]}`,
      );
    }
    if ((VOCABULARY_CLAIMS as readonly string[]).includes(name)) {
      if (found.values === undefined || typeof found.values[0] !== "string") {
        throw new InvalidDocumentError(
          origin,
          `${name} must declare its vocabulary as string values`,
        );
      }
      claims[name as (typeof VOCABULARY_CLAIMS)[number]] =
        found.values as string[];
      continue;
    }
    if (PROFILE_CLAIMS.has(name)) {
      if (found.values !== undefined) {
        throw new InvalidDocumentError(
          origin,
          `${name} is a member of the user; it cannot be restricted to values`,
        );
      }
      claims.profile.push(name);
      continue;
    }
    claims.meta[name] = lower(
      found,
      types[name] ?? STANDARD_CLAIMS[name] ?? "string",
    );
  }

  return claims;
};
