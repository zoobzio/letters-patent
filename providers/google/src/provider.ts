import type { Contract } from "letters-patent";
import type { State } from "letters-patent/kit";
import type { GoogleClaims, GoogleOptions, Session, Settings } from "./types";

import { defineProvider } from "letters-patent/kit";
import { getQuery, getRequestURL } from "h3";

import {
  DEFAULT_COOKIE,
  DEFAULT_MAX_AGE,
  DEFAULT_SCOPES,
  GOOGLE,
  MIN_SECRET,
} from "./constant";
import { GoogleError } from "./error";
import { authorize, exchange, renew, revoke } from "./oauth";
import {
  clearSession,
  readSession,
  takeFlow,
  writeFlow,
  writeSession,
} from "./session";
import { verify } from "./token";
import { internal, random, same } from "./util";

/**
 * The options with every default applied, proven usable.
 */
const settle = (options: GoogleOptions): Settings => {
  if (options.secret.length < MIN_SECRET) {
    throw new GoogleError(
      "configuration",
      `The sealing secret must be at least ${MIN_SECRET} characters`,
      { statusCode: 500 },
    );
  }
  const scopes = new Set(["openid", ...(options.scopes ?? DEFAULT_SCOPES)]);
  const secure =
    options.cookie?.secure ??
    getRequestURL(options.event, { xForwardedProto: true }).protocol ===
      "https:";
  return {
    event: options.event,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    redirectUri: options.redirectUri,
    secret: options.secret,
    scopes: [...scopes],
    ...(options.hostedDomain === undefined
      ? {}
      : { hostedDomain: options.hostedDomain }),
    ...(options.prompt === undefined ? {} : { prompt: options.prompt }),
    offline: options.offline ?? false,
    redirect: options.redirect ?? "/",
    cookie: {
      name: options.cookie?.name ?? DEFAULT_COOKIE,
      maxAge: options.cookie?.maxAge ?? DEFAULT_MAX_AGE,
      path: options.cookie?.path ?? "/",
      sameSite: options.cookie?.sameSite ?? "lax",
      secure,
      ...(options.cookie?.domain === undefined
        ? {}
        : { domain: options.cookie.domain }),
    },
    endpoints: { ...GOOGLE, ...options.endpoints },
    fetch: options.fetch ?? ((input, init) => globalThis.fetch(input, init)),
  };
};

/**
 * A session of the configured lifetime over a set of claims, starting now.
 */
const session = (
  settings: Settings,
  claims: GoogleClaims,
  refresh: string | undefined,
): Session => {
  const issued = Date.now();
  return {
    claims,
    issued,
    expires: issued + settings.cookie.maxAge * 1000,
    ...(refresh === undefined ? {} : { refresh }),
  };
};

/**
 * The query parameter as a single string, if it is one.
 */
const single = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * The Google provider: a server-side OpenID Connect authorization code
 * flow with PKCE, holding the session in a sealed, HTTP-only cookie.
 *
 * - `login` records the flow (CSRF state, ID token nonce, PKCE verifier,
 *   return path) in a short-lived cookie and continues at Google's
 *   authorization URL.
 * - `callback` checks the state, exchanges the code, verifies the ID token
 *   against Google's published keys, seals the session, establishes the
 *   user through the bridge, and continues at the return path.
 * - `resolve` opens the session cookie and establishes the user through the
 *   bridge — on every request, so grants the bridge draws from the app's
 *   own records are always current.
 * - `refresh` slides the session's lifetime; with a refresh token it first
 *   obtains a fresh ID token from Google, and a revoked grant ends the
 *   session.
 * - `logout` revokes the refresh token when there is one and clears the
 *   cookie.
 *
 * The bridge receives the verified ID token claims. Google knows nothing of
 * the app's scopes and roles: the bridge supplies them, most often by
 * looking the user up by `sub` or `email`. The provider adds the session's
 * `issued` and `expires` to whatever the bridge returns, unless the bridge
 * set them itself.
 */
export const createGoogleProvider = defineProvider<GoogleOptions, GoogleClaims>(
  (options, bridge) => {
    const settings = settle(options);

    const establish = async (
      state: State<Contract>,
      current: Session,
    ): Promise<void> => {
      const user = await bridge(current.claims);
      state.current = {
        issued: current.issued,
        expires: current.expires,
        ...user,
      };
    };

    return {
      login: async () => {
        const flow = {
          state: random(),
          nonce: random(),
          verifier: random(48),
          redirect: internal(
            getQuery(settings.event).redirect,
            settings.redirect,
          ),
        };
        await writeFlow(settings, flow);
        return { location: await authorize(settings, flow) };
      },

      callback: async (state) => {
        const query = getQuery(settings.event);
        const flow = await takeFlow(settings);
        if (flow === null) {
          throw new GoogleError("flow", "No login flow is in progress");
        }
        const denied = single(query.error);
        if (denied !== undefined) {
          throw new GoogleError(
            "denied",
            `Google denied the login (${denied})`,
            {
              detail: denied,
            },
          );
        }
        const returned = single(query.state);
        if (returned === undefined || !same(returned, flow.state)) {
          throw new GoogleError(
            "flow",
            "The login flow's state does not match",
          );
        }
        const code = single(query.code);
        if (code === undefined) {
          throw new GoogleError(
            "flow",
            "Google returned no authorization code",
          );
        }

        const tokens = await exchange(settings, code, flow.verifier);
        if (tokens.id_token === undefined) {
          throw new GoogleError("exchange", "Google returned no ID token", {
            statusCode: 502,
          });
        }
        const claims = await verify(settings, tokens.id_token, {
          nonce: flow.nonce,
        });

        // Establish first: a bridge that fails leaves no cookie behind.
        const current = session(settings, claims, tokens.refresh_token);
        await establish(state, current);
        await writeSession(settings, current);
        return { location: flow.redirect };
      },

      resolve: async (state) => {
        const current = await readSession(settings);
        if (current === null) {
          state.current = null;
          return;
        }
        await establish(state, current);
      },

      refresh: async (state) => {
        const current = await readSession(settings);
        if (current === null) {
          state.current = null;
          return;
        }
        let claims = current.claims;
        if (current.refresh !== undefined) {
          try {
            const tokens = await renew(settings, current.refresh);
            if (tokens.id_token !== undefined) {
              claims = await verify(settings, tokens.id_token);
            }
          } catch (error) {
            // The grant is gone — revoked, or the account changed. The
            // session goes with it.
            if (
              error instanceof GoogleError &&
              error.detail === "invalid_grant"
            ) {
              clearSession(settings);
              state.current = null;
              return;
            }
            throw error;
          }
        }
        const next = session(settings, claims, current.refresh);
        await establish(state, next);
        await writeSession(settings, next);
      },

      logout: async (state) => {
        const current = await readSession(settings);
        if (current?.refresh !== undefined) {
          await revoke(settings, current.refresh);
        }
        clearSession(settings);
        state.current = null;
      },
    };
  },
);
