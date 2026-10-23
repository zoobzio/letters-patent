import type { FakeGoogle } from "./google";
import type { Bridge } from "letters-patent/kit";
import type { GoogleClaims, GoogleOptions } from "../src/types";

import { defineSchema } from "letters-patent";
import { defineState } from "letters-patent/kit";
import {
  createApp,
  createRouter,
  eventHandler,
  getHeader,
  getRouterParam,
  sendRedirect,
  setResponseStatus,
  toWebHandler,
} from "h3";

import { GoogleError } from "../src/error";
import { createGoogleProvider } from "../src/provider";

export const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["admin", "editor"],
  meta: { plan: ["free", "pro"] },
});

export type C = (typeof schema)["base"];

export const SECRET = "an-application-secret-of-at-least-32-characters";

/**
 * The app's own records: what Google cannot know. The bridge looks the
 * account up here, as a real app would in its database.
 */
export const database = new Map([
  [
    "104958204857204857204",
    { scopes: ["docs:read", "docs:write"], roles: ["editor"], plan: "pro" },
  ],
]);

export const bridge: Bridge<GoogleClaims, C> = async (claims) => {
  const account = database.get(claims.sub);
  return {
    id: claims.sub,
    ...(claims.email === undefined ? {} : { email: claims.email }),
    ...(claims.name === undefined ? {} : { name: claims.name }),
    ...(claims.picture === undefined ? {} : { avatar: claims.picture }),
    ...(claims.email_verified === undefined
      ? {}
      : { verified: claims.email_verified }),
    scopes: (account?.scopes ?? []) as ("docs:read" | "docs:write")[],
    roles: (account?.roles ?? []) as ("admin" | "editor")[],
    meta: { plan: account?.plan === "pro" ? "pro" : "free" },
  };
};

export interface RequestOptions {
  method?: "GET" | "POST";
  query?: Record<string, string>;
  /** A top-level navigation (the default) or a fetch from the transport. */
  navigate?: boolean;
  headers?: Record<string, string>;
}

/**
 * A served app: the auth routes over the provider, with a cookie jar that
 * plays the browser — every `Set-Cookie` is kept and sent back.
 */
export interface Served {
  jar: Map<string, string>;
  request(action: string, options?: RequestOptions): Promise<Response>;
}

/**
 * Serves the auth routes the way the Nuxt integration's `defineAuthHandlers`
 * does, over a real h3 app: the provider is constructed per request with
 * the event, and a continuation becomes a 302 for a navigating browser or
 * data for a fetch. A `GoogleError` is answered as `{ code, detail }` with
 * its status so tests can read where a flow failed.
 */
export const serve = (
  google: FakeGoogle,
  options: Partial<GoogleOptions> = {},
  bridging: Bridge<GoogleClaims, C> = bridge,
): Served => {
  const app = createApp();
  const router = createRouter();

  router.use(
    "/api/auth/:action",
    eventHandler(async (event) => {
      const action = getRouterParam(event, "action");
      const state = defineState(schema);
      const provider = createGoogleProvider(
        schema,
        {
          event,
          clientId: google.clientId,
          clientSecret: google.clientSecret,
          redirectUri: google.redirectUri,
          secret: SECRET,
          fetch: google.fetch,
          ...options,
        },
        bridging,
      );
      const navigating = getHeader(event, "sec-fetch-mode") === "navigate";

      try {
        switch (action) {
          case "session":
            await provider.resolve(state, schema);
            return state.current;
          case "login": {
            const next = await provider.login(state, schema);
            if (!next) return state.current;
            return navigating ? sendRedirect(event, next.location, 302) : next;
          }
          case "callback": {
            const next = await provider.callback!(state, schema);
            if (!next) return state.current;
            return navigating ? sendRedirect(event, next.location, 302) : next;
          }
          case "logout":
            await provider.resolve(state, schema);
            if (state.current !== null) await provider.logout(state, schema);
            return null;
          case "refresh":
            await provider.resolve(state, schema);
            if (state.current !== null) await provider.refresh!(state, schema);
            return state.current;
          default:
            setResponseStatus(event, 404);
            return { code: "unknown" };
        }
      } catch (error) {
        if (error instanceof GoogleError) {
          setResponseStatus(event, error.statusCode);
          return { code: error.code, detail: error.detail ?? null };
        }
        // Anything else is answered here rather than rethrown: h3 logs every
        // unhandled error it turns into a 500, and a test that provokes one
        // on purpose should not be noisy.
        setResponseStatus(event, 500);
        return {
          code: "unhandled",
          detail: error instanceof Error ? error.name : String(error),
        };
      }
    }),
  );

  app.use(router);
  const handle = toWebHandler(app);
  const jar = new Map<string, string>();

  return {
    jar,
    async request(
      action,
      { method = "GET", query = {}, navigate = true, headers = {} } = {},
    ) {
      const url = new URL(`http://app.test/api/auth/${action}`);
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
      const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      const response = await handle(
        new Request(url, {
          method,
          headers: {
            ...(cookie === "" ? {} : { cookie }),
            "sec-fetch-mode": navigate ? "navigate" : "cors",
            ...headers,
          },
        }),
      );
      for (const line of response.headers.getSetCookie()) {
        const [pair, ...attributes] = line.split(";");
        const [name, value] = (pair ?? "").split("=");
        if (name === undefined) continue;
        const gone = attributes.some((a) => /^\s*max-age=(0|-)/i.test(a));
        if (gone || value === undefined || value === "") {
          jar.delete(name);
        } else {
          jar.set(name, value);
        }
      }
      return response;
    },
  };
};

/**
 * A JSON answer, or `null` for the 204 h3 sends for a `null` return.
 */
export const read = async (response: Response): Promise<unknown> =>
  response.status === 204 ? null : response.json();

/**
 * The flow's parameters, read off the authorization URL as the browser
 * would carry them to Google.
 */
export const flowOf = (location: string) => {
  const url = new URL(location);
  const get = (name: string): string => {
    const value = url.searchParams.get(name);
    if (value === null) throw new Error(`authorization URL lacks ${name}`);
    return value;
  };
  return {
    url,
    state: get("state"),
    nonce: get("nonce"),
    challenge: get("code_challenge"),
  };
};

/**
 * The Set-Cookie line for a name, split into its attributes.
 */
export const cookieOf = (response: Response, name: string) => {
  const line = response.headers
    .getSetCookie()
    .find((l) => l.startsWith(`${name}=`));
  if (line === undefined) return undefined;
  const [pair, ...rest] = line.split(";").map((p) => p.trim());
  return {
    value: (pair ?? "").slice(name.length + 1),
    attributes: new Map(
      rest.map((a) => {
        const [k, v] = a.split("=");
        return [(k ?? "").toLowerCase(), v ?? ""] as const;
      }),
    ),
  };
};

/**
 * Runs the whole login leg: `login`, then the callback with a code Google
 * minted for the flow. Leaves the jar holding a session.
 */
export const signIn = async (
  served: Served,
  google: FakeGoogle,
  options: { redirect?: string; refresh?: boolean } = {},
): Promise<Response> => {
  const login = await served.request("login", {
    ...(options.redirect === undefined
      ? {}
      : { query: { redirect: options.redirect } }),
  });
  const flow = flowOf(login.headers.get("location") ?? "");
  const code = google.issue({
    nonce: flow.nonce,
    challenge: flow.challenge,
    ...(options.refresh === undefined ? {} : { refresh: options.refresh }),
  });
  return served.request("callback", { query: { code, state: flow.state } });
};
