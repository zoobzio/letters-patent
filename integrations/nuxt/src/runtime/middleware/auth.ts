import { login } from "#build/letters-patent.mjs";

import {
  createError,
  defineNuxtRouteMiddleware,
  navigateTo,
  useNuxtApp,
} from "#app";

import { guard } from "../guard";

/**
 * The named `auth` route middleware. Opt in per page with
 * `definePageMeta({ middleware: "auth" })`; declare requirements with the
 * contract's own vocabulary via `definePageMeta({ auth: { scopes, roles } })`.
 *
 * An unauthenticated visitor is sent to the configured login route with the
 * attempted path in the `redirect` query parameter; an authenticated user
 * that falls short of the page's requirements gets a 403 — the service's
 * `denied` event has already fired with the failed check.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useNuxtApp().$auth;

  switch (guard(auth, to.meta.auth)) {
    case "unauthenticated":
      return navigateTo({
        path: login,
        query: { redirect: to.fullPath },
      });
    case "denied":
      throw createError({ statusCode: 403, statusMessage: "Forbidden" });
    case "granted":
      return;
  }
});
