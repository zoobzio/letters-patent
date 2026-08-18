// Typecheck-only stub for the Nuxt `#app` virtual module.
import type { AppAuth } from "../runtime/types";

/** The Nuxt app instance. `$auth` is added by the letters-patent runtime. */
export interface NuxtApp {
  $auth: AppAuth;
}

interface NuxtPluginDef {
  name: string;
  dependsOn?: string[];
  setup: (
    nuxtApp: NuxtApp,
  ) =>
    | void
    | { provide?: Record<string, unknown> }
    | Promise<void | { provide?: Record<string, unknown> }>;
}

export declare function defineNuxtPlugin(plugin: NuxtPluginDef): NuxtPluginDef;

export declare function useNuxtApp(): NuxtApp;

/** Page metadata. The letters-patent runtime augments this with `auth`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- merge target
export interface PageMeta {}

/** The slice of a route location the middleware touches. */
export interface RouteLocation {
  fullPath: string;
  meta: PageMeta;
}

type RouteMiddleware = (
  to: RouteLocation,
  from: RouteLocation,
) => void | Promise<void> | ReturnType<typeof navigateTo>;

export declare function defineNuxtRouteMiddleware(
  middleware: RouteMiddleware,
): RouteMiddleware;

export declare function navigateTo(to: {
  path: string;
  query?: Record<string, string>;
}): Promise<void>;

export declare function createError(input: {
  statusCode: number;
  statusMessage?: string;
}): Error;
