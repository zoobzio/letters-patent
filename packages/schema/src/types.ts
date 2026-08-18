/**
 * A meta field declaration: a scalar keyword (`?`-suffixed when the field is
 * optional) or an enum of string literals the field must be drawn from.
 */
export type Field =
  | "string"
  | "string?"
  | "number"
  | "number?"
  | "boolean"
  | "boolean?"
  | readonly string[];

/**
 * The static, serializable configuration a schema is derived from: which
 * scopes and roles exist, and how the consumer-defined meta is constructed.
 * The contract is plain data — it can be written to a build template or sent
 * over a wire — and it carries the vocabulary in its types: `Scope`, `Role`,
 * and `Meta` are all read off the contract by inference.
 */
export interface Contract {
  /**
   * The scope vocabulary — the fine-grained authorization surface. Grants
   * and checks are both members of this set.
   */
  scopes: readonly string[];

  /**
   * The role vocabulary — coarse-grained authorization, a peer of scopes.
   */
  roles: readonly string[];

  /**
   * The meta construction: one {@link Field} declaration per consumer-defined
   * member. The declared shape becomes the `Meta` type and the runtime rules
   * in one stroke.
   */
  meta: Record<string, Field>;
}

/**
 * A scope name declared by the contract.
 */
export type Scope<C extends Contract> = C["scopes"][number];

/**
 * A role name declared by the contract.
 */
export type Role<C extends Contract> = C["roles"][number];

/**
 * The value type a single {@link Field} declaration admits.
 */
export type Scalar<F extends Field> = F extends "string" | "string?"
  ? string
  : F extends "number" | "number?"
    ? number
    : F extends "boolean" | "boolean?"
      ? boolean
      : F extends readonly string[]
        ? F[number]
        : never;

/**
 * The `?`-suffixed keywords — the field declarations whose members may be
 * absent.
 */
export type Optional = "string?" | "number?" | "boolean?";

/**
 * The meta type a contract constructs: required members from plain fields,
 * optional members from `?`-suffixed ones, enum arrays narrowed to their
 * literal union.
 */
export type Meta<C extends Contract> = {
  -readonly [
    K in keyof C["meta"] as C["meta"][K] extends Optional ? never : K
  ]: Scalar<C["meta"][K]>;
} & {
  -readonly [
    K in keyof C["meta"] as C["meta"][K] extends Optional ? K : never
  ]?: Scalar<C["meta"][K]>;
};

/**
 * A stable discriminant for a validation failure: identifies the rule that
 * failed, independent of the human-readable message.
 */
export type Code =
  | "not_object"
  | "not_string"
  | "not_number"
  | "not_boolean"
  | "not_array"
  | "not_member"
  | "not_field"
  | "empty"
  | "missing"
  | "unknown"
  | "duplicate";

/**
 * A single validation failure: the failed rule's {@link Code}, a
 * human-readable message, and the path to the failing member — absent when
 * the issue concerns the value as a whole. `expected` and `received` carry
 * the rule's expectation and the offending value when they aid diagnosis.
 */
export interface Issue {
  code: Code;
  message: string;
  path?: (string | number)[];
  expected?: unknown;
  received?: unknown;
}

/**
 * A single validation rule: yields an {@link Issue} describing how a value
 * falls short, or `undefined` when the value satisfies it. Kinds are
 * validated by rule lists, so one failed rule never masks another.
 */
export type Rule = (value: unknown) => Issue | undefined;

/**
 * Every kind mapped to the type it narrows to, parameterized by the
 * contract. The validation families are all derived from this map, so
 * adding a kind is one entry here plus its rule list.
 */
export interface Domain<C extends Contract> {
  contract: Contract;
  scope: Scope<C>;
  role: Role<C>;
  scopes: Scope<C>[];
  roles: Role<C>[];
  meta: Meta<C>;
  user: User<Meta<C>>;
}

/**
 * The name of a validated kind.
 */
export type Kind = keyof Domain<Contract>;

/**
 * The rule lists validation runs, one per kind.
 */
export type Rules = { [K in Kind]: Rule[] };

/**
 * The outcome of a non-throwing validation: success with the narrowed value,
 * or failure with every {@link Issue} found.
 */
export type Result<V> =
  { success: true; data: V } | { success: false; issues: Issue[] };

/**
 * The contract's derived sets — the vocabulary membership rules check
 * against.
 */
export interface Enum<C extends Contract> {
  scopes: Set<Scope<C>>;
  roles: Set<Role<C>>;
  meta: Set<string>;
}

/**
 * Boolean type predicates, one per kind: `true` narrows the value.
 */
export type Check<C extends Contract> = {
  [K in Kind]: (value: unknown) => value is Domain<C>[K];
};

/**
 * Throwing assertions, one per kind: each runs every rule, collects all the
 * {@link Issue}s, and throws a {@link SchemaError} if any were found.
 */
export interface Assert<C extends Contract> {
  contract(value: unknown): asserts value is Contract;
  scope(value: unknown): asserts value is Scope<C>;
  role(value: unknown): asserts value is Role<C>;
  scopes(value: unknown): asserts value is Scope<C>[];
  roles(value: unknown): asserts value is Role<C>[];
  meta(value: unknown): asserts value is Meta<C>;
  user(value: unknown): asserts value is User<Meta<C>>;
}

/**
 * Asserting parsers, one per kind: each asserts the value and returns it
 * narrowed to the kind type — the gate for foreign values at a trust
 * boundary.
 */
export type Parse<C extends Contract> = {
  [K in Kind]: (value: unknown) => Domain<C>[K];
};

/**
 * The non-throwing analog of {@link Parse}: each kind captures the outcome
 * as a {@link Result} instead of throwing.
 */
export type Inspect<C extends Contract> = {
  [K in Kind]: (value: unknown) => Result<Domain<C>[K]>;
};

/**
 * The bundle {@link defineSchema} returns: the source contract, its derived
 * sets and rule lists, and the four validation families, all narrowed to the
 * contract's vocabulary.
 */
export interface Schema<C extends Contract> {
  base: C;
  enums: Enum<C>;
  rules: Rules;
  check: Check<C>;
  assert: Assert<C>;
  parse: Parse<C>;
  inspect: Inspect<C>;
}

/**
 * The fixed top-level shape every letters-patent user satisfies. `Meta` is the
 * consumer-defined portion, typed per service instance.
 */
export interface User<Meta> {
  /**
   * Stable unique identifier, as issued by the authentication provider.
   */
  id: string;

  /**
   * Email address, when the provider supplies one.
   */
  email?: string;

  /**
   * Human-readable display name, when the provider supplies one.
   */
  name?: string;

  /**
   * User name selected by the user.
   */
  username?: string;

  avatar?: string;

  /**
   * Account status as reported by the provider (e.g. "active",
   * "suspended").
   */
  status?: string;

  /**
   * Granted scopes — the fine-grained authorization surface `can()` checks
   * against. Effective for the context the user was resolved in.
   */
  scopes: string[];

  /**
   * Assigned roles — coarse-grained authorization, a peer of scopes.
   * Effective for the context the user was resolved in.
   */
  roles: string[];

  issued?: number;

  /**
   * Epoch-milliseconds timestamp after which the session is considered
   * stale. Crest never acts on staleness itself; it only reports it.
   */
  expires?: number;

  verified?: boolean;

  /**
   * Consumer-defined fields.
   */
  meta: Meta;
}
