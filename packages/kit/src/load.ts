import type { KitConfig } from "./types";

import { existsSync } from "node:fs";

import { keyword } from "@letters-patent/schema";
import { createJiti } from "jiti";
import { entries, record } from "objectively";

import {
  InvalidConfigError,
  MalformedConfigError,
  MissingConfigError,
} from "./error";
import { inside, normalize } from "./source";

/** Whether a value is a source designator: a string or a URL. */
const isSource = (value: unknown): value is string | URL =>
  (typeof value === "string" && value !== "") || value instanceof URL;

/**
 * Whether a value is a plain record with a `resource` source.
 * {@link validate} checks the other members.
 */
const isConfig = (value: unknown): value is KitConfig =>
  record(value) && isSource(value.resource);

/**
 * Checks a config against its rules before any document is read: every
 * source is a string or URL, every issuer id is a usable file name, every
 * `types` entry is a bare keyword, and `outDir` stays inside the project.
 *
 * @throws InvalidConfigError when a rule is broken.
 */
export const validate = (config: KitConfig): void => {
  if (!isSource(config.resource)) {
    throw new InvalidConfigError("resource", "resource must be a path or URL");
  }
  for (const member of ["claims", "openapi"] as const) {
    const source = config[member];
    if (source !== undefined && !isSource(source)) {
      throw new InvalidConfigError(member, `${member} must be a path or URL`);
    }
  }
  if (config.issuers !== undefined) {
    if (!record(config.issuers)) {
      throw new InvalidConfigError(
        "issuers",
        "issuers must map an id to a discovery document or issuer URL",
      );
    }
    for (const [id, source] of entries(config.issuers)) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
        throw new InvalidConfigError(
          "issuers",
          `issuer id ${JSON.stringify(id)} must be lowercase letters, digits, and hyphens`,
        );
      }
      if (!isSource(source)) {
        throw new InvalidConfigError(
          "issuers",
          `issuer ${id} must be a path or URL`,
        );
      }
    }
  }
  if (config.types !== undefined) {
    if (!record(config.types)) {
      throw new InvalidConfigError(
        "types",
        "types must map a claim to a keyword",
      );
    }
    for (const [claim, word] of entries(config.types)) {
      if (typeof word !== "string" || keyword(word) !== word) {
        throw new InvalidConfigError(
          "types",
          `types.${claim} must be a bare keyword (string, number, boolean, string[], number[])`,
        );
      }
    }
  }
  if (config.describe !== undefined && !record(config.describe)) {
    throw new InvalidConfigError("describe", "describe must be an object");
  }
  if (config.outDir !== undefined) {
    if (
      typeof config.outDir !== "string" ||
      !inside(normalize(config.outDir))
    ) {
      throw new InvalidConfigError(
        "outDir",
        "outDir must be a relative path inside the project",
      );
    }
  }
};

/**
 * Loads a config file through jiti and returns its default export. The file
 * can be TypeScript or JavaScript. The outer shape is checked here;
 * {@link resolveKit} validates the rest.
 *
 * @param path - The absolute path to the config file.
 * @throws MissingConfigError when no file exists at `path`.
 * @throws MalformedConfigError when the default export is not a config.
 */
export const loadConfig = async (path: string): Promise<KitConfig> => {
  if (!existsSync(path)) {
    throw new MissingConfigError(path);
  }
  const jiti = createJiti(import.meta.url, { moduleCache: false });
  const config = await jiti.import<unknown>(path, { default: true });
  if (!isConfig(config)) {
    throw new MalformedConfigError(path);
  }
  return config;
};
