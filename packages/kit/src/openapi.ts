import { entries, record } from "objectively";

import { InvalidDocumentError } from "./error";

/**
 * Reads the scope descriptions out of an OpenAPI document: every `oauth2`
 * security scheme's `flows.*.scopes` (OpenAPI 3) or `scopes` (Swagger 2) is
 * a map of scope name to description. A later scheme wins on a repeated
 * name. RFC 9728 lists scopes but has no text for them; this is the one
 * standard place an API describes its scopes.
 *
 * @param doc - The parsed JSON.
 * @param origin - Where the document came from, for error messages.
 */
export const parseOpenApi = (
  doc: unknown,
  origin: string,
): Record<string, string> => {
  if (!record(doc)) {
    throw new InvalidDocumentError(origin, "must be a JSON object");
  }
  const described: Record<string, string> = {};
  const take = (scopes: unknown): void => {
    if (!record(scopes)) {
      return;
    }
    for (const [scope, description] of entries(scopes)) {
      if (typeof description === "string") {
        described[scope] = description;
      }
    }
  };

  const components = record(doc.components) ? doc.components : undefined;
  const schemes = components?.securitySchemes ?? doc.securityDefinitions;
  if (!record(schemes)) {
    return described;
  }
  for (const scheme of Object.values(schemes)) {
    if (!record(scheme) || scheme.type !== "oauth2") {
      continue;
    }
    if (record(scheme.flows)) {
      for (const flow of Object.values(scheme.flows)) {
        if (record(flow)) {
          take(flow.scopes);
        }
      }
    }
    take(scheme.scopes);
  }
  return described;
};
