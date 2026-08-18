import type { Contract, Schema } from "letters-patent";
import type { Provider } from "letters-patent/kit";

import { useRequestFetch } from "#imports";

/**
 * Dials an auth route under the configured prefix. `useRequestFetch`
 * returns a fetch that forwards the incoming request's cookies during SSR,
 * so a server-side `resolve()` reaches the session route with the user's
 * cookie attached; in the browser it is a plain same-origin fetch.
 */
const call = async (
  prefix: string,
  action: string,
  options?: { method: "POST" },
): Promise<unknown> => {
  const request = useRequestFetch();
  return await request(`${prefix}/${action}`, options);
};

/**
 * A wire payload proven and narrowed, or `null` for an empty answer.
 */
const settle = <C extends Contract>(schema: Schema<C>, payload: unknown) =>
  payload === null || payload === undefined ? null : schema.parse.user(payload);

/**
 * The browser-side provider the module ships. Its vendor is the app's own
 * auth routes: every callback dials `${prefix}/…` (the module's `prefix`
 * option, carried in from the build template), the wire answers with the
 * session state after the action, and the payload is proven against the
 * schema before it lands in state. The auth host never reaches the browser
 * — the user's real provider runs only inside the server handlers.
 */
export const transport = <C extends Contract>(prefix: string): Provider<C> => ({
  login: async (state, schema) => {
    const payload = await call(prefix, "login", { method: "POST" });
    // An empty answer means the flow continues out-of-band; state stays
    // untouched until resolve() runs on return.
    const user = settle(schema, payload);
    if (user !== null) {
      state.current = user;
    }
  },
  logout: async (state) => {
    await call(prefix, "logout", { method: "POST" });
    state.current = null;
  },
  resolve: async (state, schema) => {
    const payload = await call(prefix, "session");
    state.current = settle(schema, payload);
  },
  refresh: async (state, schema) => {
    const payload = await call(prefix, "refresh", { method: "POST" });
    state.current = settle(schema, payload);
  },
});
