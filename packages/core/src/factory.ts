import type { Patent, Events } from "./types";
import type { Contract, Meta, Schema, User } from "@letters-patent/schema";
import type { Provider, State } from "@letters-patent/sdk";

import { defineState } from "@letters-patent/sdk";

/**
 * Builds the runtime {@link Patent} service over a schema and a provider.
 *
 * The caller-owned container is fronted by the schema-guarded state from
 * `defineState`, so every write — by the provider, or a deep mutation from
 * anywhere — is proven against the contract before it commits, and every
 * committed write emits `change`. The lifecycle methods invoke the matching
 * provider callback with the guarded state and the schema; the provider
 * assigns what it establishes, and letters-patent reads the outcome back off the
 * state.
 *
 * @param schema - The validation bundle derived from the app's contract.
 * @param provider - The authentication callbacks the lifecycle delegates to.
 * @param target - The underlying container; created when omitted. Mutated
 *   in place, so a caller that owns the object (e.g. a reactive one) sees
 *   every write.
 * @returns A {@link Patent} service bound to the container.
 */
export const definePatent = <C extends Contract>(
  schema: Schema<C>,
  provider: Provider<C>,
  target: State<C> = { current: null },
): Patent<C> => {
  const handlers: {
    [Event in keyof Events<C>]: Set<(payload: Events<C>[Event]) => void>;
  } = {
    change: new Set(),
    login: new Set(),
    logout: new Set(),
    denied: new Set(),
  };

  const emit = <Event extends keyof Events<C>>(
    event: Event,
    payload: Events<C>[Event],
  ): void => {
    for (const handler of handlers[event]) handler(payload);
  };

  const state = defineState(schema, target, () => {
    emit("change", state.current);
  });

  /**
   * A disjunctive check over one of the user's grant lists: any listed
   * member suffices. An absent list reads as none. Emits `denied` with the
   * kind when the answer is no.
   */
  const any = <Member extends string>(
    check: Events<C>["denied"]["check"],
    held: (user: User<Meta<C>>) => string[] | undefined,
    required: Member[],
  ): boolean => {
    const user = state.current;
    const granted =
      user !== null &&
      required.some((member) => (held(user) ?? []).includes(member));
    if (!granted) {
      emit("denied", {
        check,
        required: required as Events<C>["denied"]["required"],
        user,
      });
    }
    return granted;
  };

  return {
    get current() {
      return state.current;
    },
    get authenticated() {
      return state.current !== null;
    },
    get stale() {
      return (
        state.current?.exp !== undefined &&
        state.current.exp * 1000 <= Date.now()
      );
    },
    can(...scopes) {
      const user = state.current;
      const granted =
        user !== null &&
        scopes.every((scope) => (user.scopes ?? []).includes(scope));
      if (!granted) emit("denied", { check: "scope", required: scopes, user });
      return granted;
    },
    is(...roles) {
      return any("role", (user) => user.roles, roles);
    },
    in(...groups) {
      return any("group", (user) => user.groups, groups);
    },
    has(...entitlements) {
      return any("entitlement", (user) => user.entitlements, entitlements);
    },
    async resolve() {
      await provider.resolve(state, schema);
      return state.current;
    },
    async login() {
      const before = state.current;
      await provider.login(state, schema);
      const after = state.current;
      if (after !== null && after !== before) {
        emit("login", after);
      }
      return after;
    },
    async logout() {
      const leaving = state.current;
      if (leaving === null) {
        return;
      }
      await provider.logout(state, schema);
      if (state.current !== null) {
        state.current = null;
      }
      emit("logout", leaving);
    },
    async refresh() {
      if (state.current !== null && provider.refresh !== undefined) {
        await provider.refresh(state, schema);
      }
      return state.current;
    },
    on(event, handler) {
      handlers[event].add(handler);
      return () => {
        handlers[event].delete(handler);
      };
    },
  };
};
