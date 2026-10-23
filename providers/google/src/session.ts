import type { Flow, Session, Settings } from "./types";

import { deleteCookie, getCookie, setCookie } from "h3";

import { FLOW_MAX_AGE } from "./constant";
import { open, seal } from "./seal";
import { record } from "./util";

/**
 * The flow cookie's name: the session cookie's, suffixed.
 */
const flowName = (settings: Settings): string => `${settings.cookie.name}.flow`;

const attributes = (settings: Settings, maxAge: number) => ({
  maxAge,
  path: settings.cookie.path,
  httpOnly: true,
  sameSite: settings.cookie.sameSite,
  secure: settings.cookie.secure,
  ...(settings.cookie.domain === undefined
    ? {}
    : { domain: settings.cookie.domain }),
});

const isSession = (value: unknown): value is Session =>
  record(value) &&
  record(value.claims) &&
  typeof value.claims.sub === "string" &&
  typeof value.issued === "number" &&
  typeof value.expires === "number" &&
  (value.refresh === undefined || typeof value.refresh === "string");

const isFlow = (value: unknown): value is Flow =>
  record(value) &&
  typeof value.state === "string" &&
  typeof value.nonce === "string" &&
  typeof value.verifier === "string" &&
  typeof value.redirect === "string";

/**
 * The session the request carries, or `null`: absent, unopenable, or past
 * its own expiry. A cookie that cannot serve is cleared.
 */
export const readSession = async (
  settings: Settings,
): Promise<Session | null> => {
  const cookie = getCookie(settings.event, settings.cookie.name);
  if (cookie === undefined) {
    return null;
  }
  const session = await open(settings.secret, cookie);
  if (!isSession(session) || session.expires <= Date.now()) {
    clearSession(settings);
    return null;
  }
  return session;
};

/**
 * Seals a session into the response's cookie, living as long as the
 * session does.
 */
export const writeSession = async (
  settings: Settings,
  session: Session,
): Promise<void> => {
  setCookie(
    settings.event,
    settings.cookie.name,
    await seal(settings.secret, session),
    attributes(
      settings,
      Math.max(1, Math.ceil((session.expires - Date.now()) / 1000)),
    ),
  );
};

/**
 * Removes the session cookie from the response.
 */
export const clearSession = (settings: Settings): void => {
  deleteCookie(settings.event, settings.cookie.name, {
    path: settings.cookie.path,
    ...(settings.cookie.domain === undefined
      ? {}
      : { domain: settings.cookie.domain }),
  });
};

/**
 * Seals a login flow into a short-lived cookie for the callback to find.
 * `SameSite=Lax` is the strictest setting that still travels on the
 * top-level navigation back from Google.
 */
export const writeFlow = async (
  settings: Settings,
  flow: Flow,
): Promise<void> => {
  setCookie(
    settings.event,
    flowName(settings),
    await seal(settings.secret, flow),
    { ...attributes(settings, FLOW_MAX_AGE), sameSite: "lax" },
  );
};

/**
 * The login flow the callback request carries, or `null`. The cookie is
 * single-use: it is cleared whether or not it opened.
 */
export const takeFlow = async (settings: Settings): Promise<Flow | null> => {
  const cookie = getCookie(settings.event, flowName(settings));
  deleteCookie(settings.event, flowName(settings), {
    path: settings.cookie.path,
  });
  if (cookie === undefined) {
    return null;
  }
  const flow = await open(settings.secret, cookie);
  return isFlow(flow) ? flow : null;
};
