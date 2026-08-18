import type { Crest, Events } from "./types";
import type { Contract, Schema } from "@letters-patent/schema";
import type { Provider, State } from "@letters-patent/kit";

import { defineState } from "@letters-patent/kit";

/**
 * Builds the runtime {@link Crest} service over a schema and a provider.
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
 * @returns A {@link Crest} service bound to the container.
 */
export const defineCrest = <C extends Contract>(
  schema: Schema<C>,
  provider: Provider<C>,
  target: State<C> = { current: null },
): Crest<C> => {
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

  return {
    get current() {
      return state.current;
    },
    get authenticated() {
      return state.current !== null;
    },
    get stale() {
      return (
        state.current?.expires !== undefined &&
        state.current.expires <= Date.now()
      );
    },
    can(...scopes) {
      const user = state.current;
      const granted =
        user !== null && scopes.every((scope) => user.scopes.includes(scope));
      if (!granted) emit("denied", { check: "scope", required: scopes, user });
      return granted;
    },
    is(...roles) {
      const user = state.current;
      const granted =
        user !== null && roles.some((role) => user.roles.includes(role));
      if (!granted) emit("denied", { check: "role", required: roles, user });
      return granted;
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
