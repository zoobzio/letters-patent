import type { Contract } from "letters-patent";
import type { NuxtModule } from "@nuxt/schema";

import { defineSchema } from "letters-patent";

import {
  addImports,
  addPlugin,
  addRouteMiddleware,
  addServerImports,
  addTemplate,
  addTypeTemplate,
  createResolver,
  defineNuxtModule,
} from "@nuxt/kit";

import { DEFAULT_LOGIN, DEFAULT_PREFIX } from "./constant";

/**
 * The module's configuration: the app's contract, the one declaration both
 * sides of the wire derive their schema from, and the route prefix the
 * browser transport dials.
 */
export interface ModuleOptions {
  contract?: Contract;
  /**
   * The route prefix the auth endpoints live under. The `defineAuthHandlers`
   * route file must sit at the matching Nitro path — for the default
   * `/api/auth`, that is `server/api/auth/[action].ts`.
   *
   * @default "/api/auth"
   */
  prefix?: string;
  /**
   * The route the `auth` middleware sends unauthenticated visitors to. The
   * middleware appends the attempted path as a `redirect` query parameter.
   *
   * @default "/login"
   */
  login?: string;
}

/**
 * A string literal rendered into the type template.
 */
const literal = (value: string): string => JSON.stringify(value);

/**
 * A readonly tuple of literals rendered into the type template.
 */
const tuple = (values: readonly string[]): string =>
  `readonly [${values.map(literal).join(", ")}]`;

/**
 * Nuxt module for letters-patent.
 *
 * At build time it validates the configured contract by deriving a schema
 * from it, writes the contract and route prefix to the `letters-patent.mjs`
 * build template, and derives the `AppContract` literal type into the
 * `types/letters-patent.d.ts` type template — so the runtime service, the
 * composables, and the server handlers all speak the app's own vocabulary.
 * It registers the runtime plugin (which builds the `$auth` service and
 * resolves the user during SSR), the named `auth` route middleware,
 * auto-imports `useAuth` and `useUser` in the app, and auto-imports
 * `defineAuthHandlers` in the Nitro server. The user writes two things:
 * their provider, and the one route file that hands it to
 * `defineAuthHandlers`.
 */
const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: "letters-patent",
    configKey: "lettersPatent",
  },
  setup: (options, _nuxt) => {
    const resolver = createResolver(import.meta.url);

    const contract = options.contract;
    if (!contract) {
      throw new Error(
        "letters-patent: no contract configured — set `lettersPatent.contract` in nuxt.config.",
      );
    }

    // Fail fast on a malformed contract: deriving the schema proves it.
    defineSchema(contract);

    const prefix = (options.prefix ?? DEFAULT_PREFIX).replace(/\/+$/, "");
    if (!prefix.startsWith("/")) {
      throw new Error(
        `letters-patent: \`lettersPatent.prefix\` must start with "/" — got "${prefix}".`,
      );
    }

    const login = options.login ?? DEFAULT_LOGIN;
    if (!login.startsWith("/")) {
      throw new Error(
        `letters-patent: \`lettersPatent.login\` must start with "/" — got "${login}".`,
      );
    }

    addTemplate({
      filename: "letters-patent.mjs",
      write: true,
      getContents: () =>
        [
          `export const contract = ${JSON.stringify(contract)};`,
          `export const prefix = ${JSON.stringify(prefix)};`,
          `export const login = ${JSON.stringify(login)};`,
        ].join("\n"),
    });

    addTemplate({
      filename: "letters-patent.d.mts",
      write: true,
      getContents: () =>
        [
          `import type { AppContract } from "./types/letters-patent";`,
          `export declare const contract: AppContract;`,
          `export declare const prefix: string;`,
          `export declare const login: string;`,
        ].join("\n"),
    });

    addTypeTemplate({
      filename: "types/letters-patent.d.ts",
      write: true,
      getContents: () => {
        const meta = Object.entries(contract.meta)
          .map(
            ([key, field]) =>
              `${literal(key)}: ${
                typeof field === "string" ? literal(field) : tuple(field)
              }`,
          )
          .join("; ");
        return [
          `export type AppContract = {`,
          `  scopes: ${tuple(contract.scopes)};`,
          `  roles: ${tuple(contract.roles)};`,
          `  meta: { ${meta} };`,
          `};`,
        ].join("\n");
      },
    });

    addPlugin(resolver.resolve("./runtime/plugin"));

    addRouteMiddleware({
      name: "auth",
      path: resolver.resolve("./runtime/middleware/auth"),
    });

    addImports([
      {
        name: "useAuth",
        from: resolver.resolve("./runtime/composable"),
      },
      {
        name: "useUser",
        from: resolver.resolve("./runtime/composable"),
      },
    ]);

    addServerImports([
      {
        name: "defineAuthHandlers",
        from: resolver.resolve("./server/handlers"),
      },
    ]);
  },
});

export default module;
