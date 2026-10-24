import type { Contract as AppContract } from "#build/letters-patent/config.mjs";
import type { AuthRequirements } from "./guard";
import type { Patent } from "letters-patent";

/**
 * The active contract: the `Contract` type of the `config` module the
 * module writes under `#build/letters-patent/` — from the inline
 * `lettersPatent.contract`, or the kit config.
 */
export type { AppContract };

/**
 * The auth service provided on the Nuxt app as `$auth`, typed by the app's
 * own contract: scopes, roles, and meta all carry their declared literals.
 */
export type AppAuth = Patent<AppContract>;

/**
 * The `auth` page-meta entry the middleware reads, typed by the app's own
 * contract: an undeclared member fails to compile.
 */
export type AppAuthRequirements = AuthRequirements<AppContract>;

declare module "#app" {
  interface NuxtApp {
    $auth: AppAuth;
  }

  interface PageMeta {
    auth?: AppAuthRequirements;
  }
}
