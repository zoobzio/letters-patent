import type { Contract, Schema } from "letters-patent";
import type { Provider, Redirect } from "letters-patent/sdk";
import type { EventHandler, H3Event } from "h3";

import { defineState } from "letters-patent/sdk";
import {
  createError,
  defineEventHandler,
  getHeader,
  getRouterParam,
  sendRedirect,
} from "h3";

/**
 * Whether the request is a top-level navigation — a link, a form, or the
 * auth host sending the browser back — rather than a fetch from the
 * transport. Modern browsers say so outright; the `Accept` header is the
 * fallback for anything that does not.
 */
const navigation = (event: H3Event): boolean => {
  const mode = getHeader(event, "sec-fetch-mode");
  if (mode !== undefined) {
    return mode === "navigate";
  }
  return (getHeader(event, "accept") ?? "").includes("text/html");
};

/**
 * Answers an out-of-band continuation. A navigating browser is sent on with
 * a 302; the transport, fetching, cannot follow a cross-origin redirect, so
 * it receives the location as data and navigates itself.
 */
const continueAt = async (
  event: H3Event,
  next: Redirect,
): Promise<Redirect | undefined> => {
  if (navigation(event)) {
    await sendRedirect(event, next.location, 302);
    return undefined;
  }
  return next;
};

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
 * - `session`  → `resolve` — the current user, or `null`
 * - `login`    → `login` — the established user, or the out-of-band
 *   continuation: a 302 to the auth host for a navigating browser, the
 *   location as data for the transport
 * - `callback` → `callback` — the return leg of an out-of-band flow; the
 *   established user, or a 302 to the in-app path the provider names
 * - `logout`   → `resolve` then `logout` — always `null`
 * - `refresh`  → `resolve` then `refresh` — the revalidated user, or `null`
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

      case "login": {
        const next = await active.login(state, schema);
        return next ? await continueAt(event, next) : state.current;
      }

      case "callback": {
        if (active.callback === undefined) {
          throw createError({
            statusCode: 404,
            statusMessage: "The provider has no callback leg",
          });
        }
        const next = await active.callback(state, schema);
        return next ? await continueAt(event, next) : state.current;
      }

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
