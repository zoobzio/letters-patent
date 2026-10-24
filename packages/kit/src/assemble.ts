import type { Contract, Schema } from "@letters-patent/schema";
import type { Claims, Resource } from "./types";

import { SchemaError, defineSchema } from "@letters-patent/schema";

import { InvalidDocumentError } from "./error";

/** One line for a schema issue: the dotted path, then the message. */
const line = (issue: { path?: (string | number)[]; message: string }) =>
  `${(issue.path ?? []).join(".")}: ${issue.message}`;

/**
 * Assembles the contract from the resource document and the claims request,
 * and proves it: `defineSchema` validates the contract against its own
 * `contract` kind, so a vocabulary the documents got past the parsers —
 * an empty name, a repeat across sections — fails here with the path.
 *
 * @param resource - The Protected Resource Metadata; its scopes are the scope vocabulary.
 * @param claims - The claims request read apart; or none, for empty vocabularies and no meta.
 * @returns The contract and its schema.
 */
export const assemble = (
  resource: Resource,
  claims?: Claims,
): { contract: Contract; schema: Schema<Contract> } => {
  const contract: Contract = {
    scopes: resource.scopes_supported,
    roles: claims?.roles ?? [],
    groups: claims?.groups ?? [],
    entitlements: claims?.entitlements ?? [],
    meta: claims?.meta ?? {},
  };
  try {
    const schema = defineSchema(contract);
    return { contract: schema.parse.contract(contract), schema };
  } catch (error) {
    if (!(error instanceof SchemaError)) {
      throw error;
    }
    throw new InvalidDocumentError(
      resource.resource,
      `the assembled contract violates the schema —\n${error.issues.map(line).join("\n")}`,
    );
  }
};
