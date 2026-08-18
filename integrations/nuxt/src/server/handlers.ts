import type { Contract, Schema } from "letters-patent";
import type { Provider } from "letters-patent/kit";
import type { EventHandler, H3Event } from "h3";

import { defineState } from "letters-patent/kit";
import { createError, defineEventHandler, getRouterParam } from "h3";

/**
 * Turn a schema and a per-request provider constructor into the server
 * endpoints the browser transport talks to. The user drops one file into
 * their Nitro server at the path matching the module's `prefix` option —
 * `server/api/auth/[action].ts` for the default `/api/auth` — whose default
 * export is `defineAuthHandlers(schema, (event) => provider)`.
 *
 * The constructor runs once per request with the h3 event: the event is the
 * provider's own domain — cookies, headers, body, everything a flow needs —
 * closed over at construction, never threaded through letters-patent. Each action
 * builds a guarded per-request state, invokes the matching callback with
 * letters-patent's own domain objects, and answers with the session state after
 * the action:
 *
 * - `session` → `resolve` — the current user, or `null`
 * - `login`   → `login` — the established user, or `null` for out-of-band
 * - `logout`  → `resolve` then `logout` — always `null`
 * - `refresh` → `resolve` then `refresh` — the revalidated user, or `null`
 *
 * The auth host never reaches the browser, which only ever sees these
 * routes.
 */
export const defineAuthHandlers = <C extends Contract>(
  schema: Schema<C>,
  provider: (event: H3Event) => Provider<C>,
): EventHandler => {
  return defineEventHandler(async (event) => {
    const action = getRouterParam(event, "action");
    const state = defineState(schema);
    const active = provider(event);

    switch (action) {
      case "session":
        await active.resolve(state, schema);
        return state.current;

      case "login":
        await active.login(state, schema);
        return state.current;

      case "logout":
        await active.resolve(state, schema);
        if (state.current !== null) {
          await active.logout(state, schema);
        }
        return null;

      case "refresh":
        await active.resolve(state, schema);
        if (state.current !== null && active.refresh !== undefined) {
          await active.refresh(state, schema);
        }
        return state.current;

      default:
        throw createError({
          statusCode: 404,
          statusMessage: `Unknown letters-patent action "${action ?? ""}"`,
        });
    }
  });
};
