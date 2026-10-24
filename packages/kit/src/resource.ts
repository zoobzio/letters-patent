import type { Resource } from "./types";

import { record } from "objectively";

import { InvalidDocumentError } from "./error";
import { isText, isTextList, repeated } from "./util";

/**
 * Reads an OAuth 2.0 Protected Resource Metadata document (RFC 9728 §2).
 * `resource` is required and must be a URL; `authorization_servers` and
 * `scopes_supported` are optional in the standard and default to empty
 * here. Every other member passes through, so the re-emitted document is
 * the authored one.
 *
 * @param doc - The parsed JSON.
 * @param origin - Where the document came from, for error messages.
 */
export const parseResource = (doc: unknown, origin: string): Resource => {
  if (!record(doc)) {
    throw new InvalidDocumentError(origin, "must be a JSON object");
  }
  const { resource, authorization_servers, scopes_supported } = doc;
  if (!isText(resource)) {
    throw new InvalidDocumentError(origin, "must name the resource", [
      "resource",
    ]);
  }
  if (!URL.canParse(resource)) {
    throw new InvalidDocumentError(origin, "must be an absolute URL", [
      "resource",
    ]);
  }
  if (
    authorization_servers !== undefined &&
    !isTextList(authorization_servers)
  ) {
    throw new InvalidDocumentError(origin, "must be an array of issuer URLs", [
      "authorization_servers",
    ]);
  }
  if (scopes_supported !== undefined && !isTextList(scopes_supported)) {
    throw new InvalidDocumentError(origin, "must be an array of scope names", [
      "scopes_supported",
    ]);
  }
  const scopes = scopes_supported ?? [];
  const twice = repeated(scopes);
  if (twice.length > 0) {
    throw new InvalidDocumentError(
      origin,
      `repeats scope${twice.length > 1 ? "s" : ""} ${twice.join(", ")}`,
      ["scopes_supported"],
    );
  }
  for (const scope of scopes) {
    if (scope.trim() === "" || /\s/.test(scope)) {
      throw new InvalidDocumentError(
        origin,
        `scope ${JSON.stringify(scope)} must be a single non-empty token`,
        ["scopes_supported"],
      );
    }
  }
  return {
    ...doc,
    resource,
    authorization_servers: authorization_servers ?? [],
    scopes_supported: scopes,
  };
};
