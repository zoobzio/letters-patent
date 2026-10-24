import type { GenerateOptions, Issuer, Kit, KitConfig, Source } from "./types";

import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { entries } from "objectively";

import { assemble } from "./assemble";
import { parseClaims } from "./claims";
import { OUT_DIR } from "./constant";
import { describe } from "./describe";
import { parseDiscovery } from "./discovery";
import { InvalidDocumentError } from "./error";
import { validate } from "./load";
import { parseOpenApi } from "./openapi";
import { parseResource } from "./resource";
import { loader, locate, locateIssuer, normalize } from "./source";
import { verify } from "./verify";

/**
 * Validates a config and resolves it into a {@link Kit}. This is the only
 * step that reads documents: the resource document, the claims request, the
 * OpenAPI document, and each issuer's discovery document. It assembles and
 * proves the contract, describes it, and verifies the documents against
 * each other. {@link generate} turns the result into files.
 *
 * @param config - The kit config.
 * @param options - The project root and I/O hooks.
 * @throws InvalidConfigError when the config breaks a rule, before any read.
 * @throws InvalidDocumentError when a document is not what its standard says.
 */
export const resolveKit = async (
  config: KitConfig,
  options: GenerateOptions = {},
): Promise<Kit> => {
  validate(config);
  const root = resolve(options.cwd ?? process.cwd());
  const { base, load, documents } = loader(root, options.req);

  /** Names a document for error messages: project-relative when local. */
  const name = (url: URL): string =>
    url.protocol === "file:" ? relative(root, fileURLToPath(url)) : url.href;

  /** Reads and parses one JSON document. */
  const read = async (url: URL): Promise<{ doc: unknown; origin: string }> => {
    const origin = name(url);
    const text = await load(url);
    try {
      return { doc: JSON.parse(text) as unknown, origin };
    } catch {
      throw new InvalidDocumentError(origin, "is not valid JSON");
    }
  };

  const at = (source: Source): URL => locate(source, base);

  const resourceDoc = await read(at(config.resource));
  const resource = parseResource(resourceDoc.doc, resourceDoc.origin);

  let claims;
  if (config.claims !== undefined) {
    const claimsDoc = await read(at(config.claims));
    claims = parseClaims(claimsDoc.doc, claimsDoc.origin, config.types);
  }

  let scopes: Record<string, string> = {};
  if (config.openapi !== undefined) {
    const openapiDoc = await read(at(config.openapi));
    scopes = parseOpenApi(openapiDoc.doc, openapiDoc.origin);
  }

  const issuers: Issuer[] = [];
  for (const [id, source] of entries(config.issuers ?? {})) {
    const issuerDoc = await read(locateIssuer(source, base));
    issuers.push(parseDiscovery(issuerDoc.doc, id, issuerDoc.origin));
  }

  const { contract } = assemble(resource, claims);
  const manifest = describe(contract, claims, config.describe, scopes);
  const warnings = verify(resource, claims, issuers);

  return {
    contract,
    resource,
    issuers,
    manifest,
    claims: claims ?? {
      requested: [],
      roles: [],
      groups: [],
      entitlements: [],
      profile: [],
      meta: {},
    },
    outDir: normalize(config.outDir ?? OUT_DIR),
    documents,
    warnings,
  };
};
