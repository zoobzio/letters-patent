import type { Bridge } from "letters-patent/sdk";
import type { Contract } from "@letters-patent/example-patents/config";
import type { Claims } from "@letters-patent/example-patents/issuers/google";
import type { H3Event } from "h3";

import { defineSchema } from "letters-patent";
import { defineProvider } from "letters-patent/sdk";
import { deleteCookie, getCookie, getQuery, setCookie } from "h3";

import config from "@letters-patent/example-patents/config";
import google from "@letters-patent/example-patents/issuers/google";

import { lookup } from "../../shared/accounts";

/** The schema over the preset's contract: what every handler proves against. */
export const schema = defineSchema<Contract>(config.contract);

/** The cookie the stub holds the signed-in subject in. */
export const COOKIE = "acme-demo";

export interface DemoOptions {
  event: H3Event;
}

/** An in-app path to land on, or `/` for anything else. */
const internal = (value: unknown): string =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";

/**
 * The stubbed provider. It has the shape of a redirect-based provider —
 * `login` continues out of band and the session lives in an HTTP-only
 * cookie — but the "issuer" is the login page's list of accounts: `login`
 * reads the account to sign in as off the query and writes the cookie
 * where a real provider would send the browser to Google and establish
 * the session in `callback`. `refresh` is offered because the issuer's
 * discovery document says Google supports the refresh token grant.
 */
export const createDemoProvider = defineProvider<DemoOptions, Claims>(
  (options, bridge) => {
    const { event } = options;

    const establish = async (state: {
      current: Awaited<ReturnType<typeof bridge>> | null;
    }): Promise<void> => {
      const sub = getCookie(event, COOKIE);
      const account = sub === undefined ? undefined : lookup(sub);
      if (account === undefined) {
        deleteCookie(event, COOKIE, { path: "/" });
        state.current = null;
        return;
      }
      state.current = await bridge(account.claims);
    };

    return {
      login: async () => {
        const query = getQuery(event);
        const account =
          typeof query.as === "string" ? lookup(query.as) : undefined;
        if (account !== undefined) {
          setCookie(event, COOKIE, account.claims.sub, {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 24,
          });
        }
        return {
          location: account === undefined ? "/login" : internal(query.redirect),
        };
      },
      resolve: establish,
      ...(google.caps.refresh ? { refresh: establish } : {}),
      logout: async (state) => {
        deleteCookie(event, COOKIE, { path: "/" });
        state.current = null;
      },
    };
  },
);

/**
 * The bridge: Google's claims and the app's own record become the
 * contract's user. The grants and the meta come from the record — Google
 * knows none of them. A subject the app does not know gets no grants and
 * the free plan: signed in, able to do nothing.
 */
export const bridge: Bridge<Claims, Contract> = (claims) => {
  const account = lookup(claims.sub);
  return {
    sub: claims.sub,
    ...(claims.email === undefined ? {} : { email: claims.email }),
    ...(claims.email_verified === undefined
      ? {}
      : { email_verified: claims.email_verified }),
    ...(claims.name === undefined ? {} : { name: claims.name }),
    scopes: account?.scopes ?? [],
    roles: account?.roles ?? [],
    groups: account?.groups ?? [],
    entitlements: account?.entitlements ?? [],
    meta: {
      plan: account?.plan ?? "free",
      workspace: account?.workspace ?? "",
    },
  };
};
