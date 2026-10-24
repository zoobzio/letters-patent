import type { Choice, Field, Issue, Keyword, Literals, Rule } from "./types";

import { object, keys, entries } from "objectively";
import { KEYWORDS } from "./constant";

/*
 * Type-agnostic rule builders. Each builder takes a display name plus
 * parameters and returns a {@link Rule}; none of them know anything about
 * the user contract. Predicate atoms each own a single failure code;
 * combinators compose other rules and attach `path` as they descend.
 */

/**
 * Prefixes a nested issue's path with the member it was found under.
 */
export const nest = (key: string | number, issue: Issue): Issue => ({
  ...issue,
  path: [key, ...(issue.path ?? [])],
});

/**
 * The value is a container: an object that is not an array.
 */
export const container =
  (name: string): Rule =>
  (v) => {
    if (!object(v)) {
      return {
        code: "not_object",
        message: `${name} must be an object.`,
        received: v,
      };
    }
  };

/**
 * The value is a string.
 */
export const text =
  (name: string): Rule =>
  (v) => {
    if (typeof v !== "string") {
      return {
        code: "not_string",
        message: `${name} must be a string.`,
        received: v,
      };
    }
  };

/**
 * A string value is not empty once trimmed.
 */
export const filled =
  (name: string): Rule =>
  (v) => {
    if (typeof v === "string" && v.trim() === "") {
      return {
        code: "empty",
        message: `${name} must not be empty.`,
        received: v,
      };
    }
  };

/**
 * The value is a number.
 */
export const numeric =
  (name: string): Rule =>
  (v) => {
    if (typeof v !== "number") {
      return {
        code: "not_number",
        message: `${name} must be a number.`,
        received: v,
      };
    }
  };

/**
 * The value is a boolean.
 */
export const flag =
  (name: string): Rule =>
  (v) => {
    if (typeof v !== "boolean") {
      return {
        code: "not_boolean",
        message: `${name} must be a boolean.`,
        received: v,
      };
    }
  };

/**
 * The value is an array whose every entry satisfies the rules. A nested
 * issue is prefixed with the entry's index.
 */
export const list =
  (name: string, rules: Rule[]): Rule =>
  (v) => {
    if (!Array.isArray(v)) {
      return {
        code: "not_array",
        message: `${name} must be an array.`,
        received: v,
      };
    }
    for (const [index, entry] of v.entries()) {
      for (const rule of rules) {
        const issue = rule(entry);
        if (issue) {
          return nest(index, issue);
        }
      }
    }
  };

/**
 * A value of the set's own type — strings, or numbers for a numeric enum —
 * is a member of the declared set. Other values yield no issue — the text
 * and numeric rules own those failures.
 */
export const member =
  (name: string, set: ReadonlySet<string | number>): Rule =>
  (v) => {
    const [first] = set;
    const kind = typeof first === "number" ? "number" : "string";
    if (typeof v === kind && !set.has(v as string | number)) {
      return {
        code: "not_member",
        message: `${name} is not declared by the contract.`,
        expected: [...set],
        received: v,
      };
    }
  };

/**
 * An array value carries no duplicate string entries.
 */
export const unique =
  (name: string): Rule =>
  (v) => {
    if (!Array.isArray(v)) {
      return;
    }
    const seen = new Set<string>();
    for (const [index, entry] of v.entries()) {
      if (typeof entry !== "string") {
        continue;
      }
      if (seen.has(entry)) {
        return nest(index, {
          code: "duplicate",
          message: `${name} must not repeat an entry.`,
          received: entry,
        });
      }
      seen.add(entry);
    }
  };

/**
 * A container value carries every required member. Non-containers yield no
 * issue — the container rule owns that failure.
 */
export const superset =
  (name: string, keys: readonly string[]): Rule =>
  (v) => {
    if (!object(v)) {
      return;
    }
    const missing = keys.filter((key) => !(key in v));
    if (missing.length > 0) {
      return {
        code: "missing",
        message: `${name} is missing required member${
          missing.length > 1 ? "s" : ""
        }: ${missing.join(", ")}.`,
        expected: keys,
        received: v,
      };
    }
  };

/**
 * A container value carries no members beyond the declared keys. Non-containers
 * yield no issue — the container rule owns that failure.
 */
export const subset =
  (name: string, declared: ReadonlySet<string>): Rule =>
  (v) => {
    if (!object(v)) {
      return;
    }
    const stray = keys(v).filter((key) => !declared.has(key));
    if (stray.length > 0) {
      return {
        code: "unknown",
        message: `${name} carries unknown member${
          stray.length > 1 ? "s" : ""
        }: ${stray.join(", ")}.`,
        expected: [...declared],
        received: v,
      };
    }
  };

/**
 * Runs rules against every member of a container, nesting an issue under the
 * member's key. Non-containers yield no issue — the container rule owns that
 * failure.
 */
export const each =
  (rules: Rule[]): Rule =>
  (v) => {
    if (!object(v)) {
      return;
    }
    for (const [key, entry] of entries(v)) {
      for (const rule of rules) {
        const issue = rule(entry);
        if (issue) {
          return nest(key, issue);
        }
      }
    }
  };

/**
 * Runs rules against one member of a container. Non-containers and absent
 * members yield no issue — the container and superset rules own those
 * failures — and a nested issue is prefixed with the member's key.
 */
export const at =
  (key: string, rules: Rule[]): Rule =>
  (v) => {
    if (!object(v) || !(key in v)) {
      return;
    }
    for (const rule of rules) {
      const issue = rule(v[key]);
      if (issue) {
        return nest(key, issue);
      }
    }
  };

/**
 * Wraps rules so `undefined` passes: the member may be absent or carry an
 * explicit `undefined`, but once a value is present the rules apply.
 */
export const optional = (rules: Rule[]): Rule[] =>
  rules.map(
    (rule): Rule =>
      (v) =>
        v === undefined ? undefined : rule(v),
  );

/*
 * Field declarations. A field is a keyword, an enum, or a choice; the
 * helpers below read a declaration apart so the rules and the kit agree on
 * what each form means.
 */

/**
 * The keyword of a scalar declaration, with any `?` suffix removed, or
 * `undefined` when the value is not a known keyword.
 */
export const keyword = (declared: unknown): Keyword | undefined => {
  if (typeof declared !== "string") {
    return undefined;
  }
  const bare = declared.endsWith("?") ? declared.slice(0, -1) : declared;
  return KEYWORDS.has(bare) ? (bare as Keyword) : undefined;
};

/**
 * Whether a {@link Field} declaration admits an absent member: a
 * `?`-suffixed keyword, or a {@link Choice} marked optional.
 */
export const absent = (declared: Field): boolean => {
  if (typeof declared === "string") {
    return declared.endsWith("?");
  }
  if (Array.isArray(declared)) {
    return false;
  }
  return (declared as Choice).optional === true;
};

/**
 * The literals of an enum or choice declaration, or `undefined` for a
 * scalar keyword.
 */
export const literals = (declared: Field): Literals | undefined => {
  if (typeof declared === "string") {
    return undefined;
  }
  if (Array.isArray(declared)) {
    return declared as Literals;
  }
  return (declared as Choice).values;
};

/**
 * Rules an enum's literals: non-empty, all strings or all numbers, no
 * empty strings. The nested issue is prefixed with the literal's index.
 */
const enumeration =
  (name: string): Rule =>
  (v) => {
    if (!Array.isArray(v)) {
      return {
        code: "not_array",
        message: `${name} must declare its literals as an array.`,
        received: v,
      };
    }
    if (v.length === 0) {
      return {
        code: "empty",
        message: `${name} must declare at least one literal.`,
        received: v,
      };
    }
    const numbers = typeof v[0] === "number";
    for (const [index, entry] of v.entries()) {
      const issue = numbers
        ? numeric(`${name} literal`)(entry)
        : (text(`${name} literal`)(entry) ?? filled(`${name} literal`)(entry));
      if (issue) {
        return nest(index, issue);
      }
    }
  };

/**
 * The value is a well-formed {@link Field} declaration: a scalar keyword,
 * an enum of literals, or a choice of literals.
 */
export const spec =
  (name: string): Rule =>
  (v) => {
    if (typeof v === "string") {
      if (keyword(v) !== undefined) {
        return;
      }
      return {
        code: "not_field",
        message: `${name} must be a scalar keyword, an enum of literals, or a choice.`,
        expected: [...KEYWORDS],
        received: v,
      };
    }
    if (Array.isArray(v)) {
      return enumeration(name)(v);
    }
    if (!object(v) || !("values" in v)) {
      return {
        code: "not_field",
        message: `${name} must be a scalar keyword, an enum of literals, or a choice.`,
        expected: [...KEYWORDS],
        received: v,
      };
    }
    const stray = subset(name, new Set(["values", "optional"]))(v);
    if (stray) {
      return stray;
    }
    const issue = enumeration(name)(v.values);
    if (issue) {
      return nest("values", issue);
    }
    if (v.optional !== undefined && typeof v.optional !== "boolean") {
      return nest("optional", {
        code: "not_boolean",
        message: `${name} optional must be a boolean.`,
        received: v.optional,
      });
    }
  };

/**
 * The rule for one scalar keyword.
 */
const scalar = (name: string, word: Keyword): Rule => {
  switch (word) {
    case "number":
      return numeric(name);
    case "boolean":
      return flag(name);
    case "string[]":
      return list(name, [text(name)]);
    case "number[]":
      return list(name, [numeric(name)]);
    default:
      return text(name);
  }
};

/**
 * The value satisfies a {@link Field} declaration: a scalar of the declared
 * keyword, or a member of the declared literals — `undefined` admitted when
 * the declaration is optional. Delegates to the scalar and member atoms, so
 * the issue carries their codes.
 */
export const field = (name: string, declared: Field): Rule => {
  const values = literals(declared);
  let rule: Rule;
  if (values !== undefined) {
    const literal = member(name, new Set<string | number>(values));
    const type = typeof values[0] === "number" ? numeric(name) : text(name);
    rule = (v) => type(v) ?? literal(v);
  } else {
    rule = scalar(name, keyword(declared) ?? "string");
  }
  if (!absent(declared)) {
    return rule;
  }
  return (v) => (v === undefined ? undefined : rule(v));
};
