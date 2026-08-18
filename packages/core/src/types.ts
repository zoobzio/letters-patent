import type { Contract, Meta, Role, Scope, User } from "@letters-patent/schema";

/** Events the service emits. Subscribe with {@link Crest.on}. */
export interface Events<C extends Contract> {
  /**
   * User state was written: established, replaced, mutated in place, or
   * cleared. Fires once per committed write — a rejected write never fires.
   */
  change: User<Meta<C>> | null;

  /**
   * A login flow established a user: `login()` returned with state newly
   * assigned. An out-of-band flow that leaves state untouched does not
   * fire — `resolve()` picks the session up when the flow returns.
   */
  login: User<Meta<C>>;

  /**
   * The session was torn down by `logout()`; the payload is the user that
   * left. Does not fire when already unauthenticated.
   */
  logout: User<Meta<C>>;

  /**
   * An authorization check failed. `check` says which kind: a `can()` scope
   * check (the user was missing at least one) or an `is()` role check (the
   * user held none of them). `required` is what was asked; `user` is `null`
   * when unauthenticated.
   */
  denied: {
    check: "scope" | "role";
    required: Scope<C>[] | Role<C>[];
    user: User<Meta<C>> | null;
  };
}

/**
 * The service: holds current user state behind the schema-guarded proxy,
 * answers authorization checks against the contract's vocabulary, and
 * invokes its provider's callbacks with letters-patent's own domain objects —
 * the guarded state and the schema. The lifecycle methods take no
 * arguments; everything a flow needs beyond state is the provider's own.
 */
export interface Crest<C extends Contract> {
  /** The current user, or `null` when unauthenticated. */
  readonly current: User<Meta<C>> | null;

  /** The current authenticated state. */
  readonly authenticated: boolean;

  /**
   * Whether the current session's `expires` has passed. Crest only
   * reports staleness — reacting to it (via `refresh` or `logout`) is the
   * consumer's call.
   */
  readonly stale: boolean;

  /**
   * Whether the current user holds every given scope (conjunctive — all are
   * required). Scopes are the contract's own — an undeclared scope fails to
   * compile. Emits `denied` when the answer is no.
   */
  can(...scopes: Scope<C>[]): boolean;

  /**
   * Whether the current user holds any of the given roles (disjunctive —
   * any one suffices). Roles are the contract's own — an undeclared role
   * fails to compile. Emits `denied` when the answer is no.
   */
  is(...roles: Role<C>[]): boolean;

  /**
   * Establish the current user from ambient context via the provider. The
   * single authoritative path by which user state is discovered.
   */
  resolve(): Promise<User<Meta<C>> | null>;

  /**
   * Initiate authentication via the provider. Resolves to the user for
   * direct flows; a flow that continues out-of-band leaves state untouched
   * — call `resolve()` when it returns.
   */
  login(): Promise<User<Meta<C>> | null>;

  /** Tear down the session via the provider and clear user state. */
  logout(): Promise<void>;

  /**
   * Revalidate the session via the provider. Cleared state means the
   * session is gone. A no-op when unauthenticated or when the provider does
   * not implement `refresh`.
   */
  refresh(): Promise<User<Meta<C>> | null>;

  /** Subscribe to a service event. Returns an unsubscribe function. */
  on<Event extends keyof Events<C>>(
    event: Event,
    handler: (payload: Events<C>[Event]) => void,
  ): () => void;
}
