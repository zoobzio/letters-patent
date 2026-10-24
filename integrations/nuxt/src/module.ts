import type { Contract } from "letters-patent";
import type { OutputFile } from "@letters-patent/kit";
import type { NuxtModule } from "@nuxt/schema";

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { defineSchema } from "letters-patent";
import { FILENAME, emit, loadConfig, resolveKit } from "@letters-patent/kit";

import {
  addImports,
  addPlugin,
  addRouteMiddleware,
  addServerImports,
  addTemplate,
  createResolver,
  defineNuxtModule,
  tryResolveModule,
  useLogger,
} from "@nuxt/kit";

import { DEFAULT_LOGIN, DEFAULT_PREFIX, MODULES } from "./constant";

/**
 * The module's configuration: where the app's contract comes from, the
 * route prefix the browser transport dials, and the login route.
 */
export interface ModuleOptions {
  /**
   * The app's contract, declared inline. When set, neither a preset nor the
   * kit config is read, and the build emits no issuer or resource files.
   */
  contract?: Contract;

  /**
   * A package that exports a kit build — `./config`, `./manifest`,
   * `./issuers`, and `./issuers/<id>` — such as one built with
   * `patent build` and published. Read when `contract` is absent. The
   * module re-exports the package's modules; the package is a dependency
   * of the app.
   */
  preset?: string;

  /**
   * The kit config to build the contract from, relative to the project
   * root. Read when `contract` and `preset` are absent. The module builds
   * it in memory with `@letters-patent/kit`, and Nuxt watches the config
   * and every document it read.
   *
   * @default "patent.config.ts"
   */
  config?: string;

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

/** What the module writes under `#build/letters-patent/`, and what to watch. */
interface Loaded {
  files: OutputFile[];
  documents: string[];
  warnings: string[];
}

/** A string literal rendered into a template. */
const literal = (value: string): string => JSON.stringify(value);

/**
 * The modules of a preset, re-exported from the package: each template
 * under `#build/letters-patent/` forwards to `<preset>/<subpath>`, with the
 * default export where the kit emits one.
 */
const forward = (preset: string, ids: string[]): OutputFile[] => {
  const modules: [subpath: string, hasDefault: boolean][] = [
    ["index", false],
    ["config", true],
    ["manifest", true],
    ["issuers", true],
    ...ids.map((id): [string, boolean] => [`issuers/${id}`, true]),
  ];
  return modules.flatMap(([subpath, hasDefault]) => {
    const from = literal(`${preset}/${subpath}`);
    const lines = [
      `export * from ${from};`,
      ...(hasDefault ? [`export { default } from ${from};`] : []),
    ];
    const contents = `${lines.join("\n")}\n`;
    return [
      { path: `${subpath}.mjs`, contents },
      { path: `${subpath}.d.mts`, contents },
    ];
  });
};

/**
 * Loads a preset: proves the contract its `./config` exports, reads the
 * issuer ids off its `./issuers`, and forwards every module.
 */
const loadPreset = async (preset: string, root: string): Promise<Loaded> => {
  const load = async (subpath: string): Promise<Record<string, unknown>> => {
    const path = await tryResolveModule(`${preset}/${subpath}`, root);
    if (path === undefined) {
      throw new Error(
        `letters-patent: the preset "${preset}" does not export "./${subpath}" — a preset is a package that exports a kit build (from ${root})`,
      );
    }
    return import(pathToFileURL(path).href) as Promise<Record<string, unknown>>;
  };
  const config = await load("config");
  defineSchema(config.contract as Contract);
  const listed = (await load("issuers")).issuers;
  const ids = Array.isArray(listed)
    ? listed.map((entry: { id: string }) => entry.id)
    : [];
  return { files: forward(preset, ids), documents: [], warnings: [] };
};

/**
 * Loads what the templates are written from: the inline contract, proven
 * and emitted bare; the preset, forwarded; or the kit config, built in
 * memory and emitted.
 */
const loadContract = async (
  options: ModuleOptions,
  root: string,
): Promise<Loaded> => {
  if (options.contract !== undefined) {
    // Fail fast on a malformed contract: deriving the schema proves it.
    defineSchema(options.contract);
    return {
      files: emit({ contract: options.contract }),
      documents: [],
      warnings: [],
    };
  }
  if (options.preset !== undefined) {
    if (typeof options.preset !== "string" || options.preset === "") {
      throw new Error("letters-patent: `preset` must be a package name");
    }
    return loadPreset(options.preset, root);
  }
  const path = resolve(root, options.config ?? FILENAME);
  const kit = await resolveKit(await loadConfig(path), { cwd: root });
  return {
    files: emit(kit),
    documents: [path, ...kit.documents],
    warnings: kit.warnings,
  };
};

/**
 * Nuxt module for letters-patent.
 *
 * At build time it resolves the app's contract — inline, from a preset
 * package, or built from the kit config — and writes the same modules
 * `patent build` writes under `#build/letters-patent/`: the contract and
 * its `Contract` type, the vocabulary guards, the manifest, and the
 * issuers. The runtime service, the composables, and the server handlers
 * all speak the app's own vocabulary. It registers the runtime plugin
 * (which builds the `$auth` service and resolves the user during SSR), the
 * named `auth` route middleware, auto-imports `useAuth` and `useUser` in
 * the app, and auto-imports `defineAuthHandlers` in the Nitro server. The
 * user writes two things: their provider, and the one route file that
 * hands it to `defineAuthHandlers`.
 */
const module: NuxtModule<ModuleOptions, ModuleOptions> =
  defineNuxtModule<ModuleOptions>({
    meta: {
      name: "letters-patent",
      configKey: "lettersPatent",
    },
    setup: async (options, nuxt) => {
      const resolver = createResolver(import.meta.url);
      const logger = useLogger("letters-patent");

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

      const { files, documents, warnings } = await loadContract(
        options,
        nuxt.options.rootDir,
      );
      for (const warning of warnings) {
        logger.warn(warning);
      }
      nuxt.options.watch.push(...documents);

      for (const file of files) {
        addTemplate({
          filename: `${MODULES}/${file.path}`,
          write: true,
          getContents: () => file.contents,
        });
      }

      addTemplate({
        filename: "letters-patent.mjs",
        write: true,
        getContents: () =>
          [
            `export { contract } from "./${MODULES}/config.mjs";`,
            `export const prefix = ${literal(prefix)};`,
            `export const login = ${literal(login)};`,
          ].join("\n"),
      });

      addTemplate({
        filename: "letters-patent.d.mts",
        write: true,
        getContents: () =>
          [
            `export { contract } from "./${MODULES}/config.mjs";`,
            `export declare const prefix: string;`,
            `export declare const login: string;`,
          ].join("\n"),
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
