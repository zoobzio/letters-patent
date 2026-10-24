import type { BuildOptions, GenerateOptions, KitConfig, Output } from "./types";

import { resolve } from "node:path";

import { FILENAME } from "./constant";
import { emit } from "./emit";
import { loadConfig } from "./load";
import { resolveKit } from "./resolve";
import { writeOutput } from "./write";

/** Types a `patent.config.ts`. Returns the config it receives. */
export const defineConfig = (config: KitConfig): KitConfig => config;

/**
 * Generates the contract modules from a kit config. Resolves the config
 * with {@link resolveKit}, then emits the modules for `outDir`. An app
 * imports the modules by relative path; a published package points its
 * `exports` at them.
 *
 * @param config - The kit config.
 * @param options - The project root and I/O hooks.
 */
export const generate = async (
  config: KitConfig,
  options: GenerateOptions = {},
): Promise<Output> => {
  const kit = await resolveKit(config, options);
  return { outDir: kit.outDir, files: emit(kit), warnings: kit.warnings };
};

/**
 * Runs the whole build: loads the config, generates the output, and writes
 * the output directory. The CLI runs this function.
 *
 * @param options - The root, the config path, and the I/O hooks.
 */
export const build = async (options: BuildOptions = {}): Promise<Output> => {
  const { root: rootOption, config: configOption, ...hooks } = options;
  const root = resolve(rootOption ?? process.cwd());
  const config = await loadConfig(resolve(root, configOption ?? FILENAME));
  const output = await generate(config, { ...hooks, cwd: root });
  await writeOutput(output, root);
  return output;
};
