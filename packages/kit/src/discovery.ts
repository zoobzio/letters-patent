import type { Endpoints, Issuer } from "./types";

import { record } from "objectively";

import { DEFAULT_GRANTS } from "./constant";
import { InvalidDocumentError } from "./error";
import { isText, isTextList } from "./util";

/**
 * Reads an authorization server's discovery document (OpenID Connect
 * Discovery §3 / RFC 8414 §2) into an {@link Issuer}: the endpoints it
 * publishes and the capabilities a provider can rely on.
 *
 * @param doc - The parsed JSON.
 * @param id - The issuer's id in the config.
 * @param origin - Where the document came from, for error messages.
 */
export const parseDiscovery = (
  doc: unknown,
  id: string,
  origin: string,
): Issuer => {
  if (!record(doc)) {
    throw new InvalidDocumentError(origin, "must be a JSON object");
  }
  const url = (key: string, required: boolean): string | undefined => {
    const value = doc[key];
    if (value === undefined) {
      if (required) {
        throw new InvalidDocumentError(origin, "is required", [key]);
      }
      return undefined;
    }
    if (!isText(value) || !URL.canParse(value)) {
      throw new InvalidDocumentError(origin, "must be an absolute URL", [key]);
    }
    return value;
  };
  const list = (key: string): string[] | undefined => {
    const value = doc[key];
    if (value === undefined) {
      return undefined;
    }
    if (!isTextList(value)) {
      throw new InvalidDocumentError(origin, "must be an array of strings", [
        key,
      ]);
    }
    return value;
  };

  const issuer = url("issuer", true) as string;
  const endpoints: Endpoints = {
    authorize: url("authorization_endpoint", true) as string,
    token: url("token_endpoint", true) as string,
  };
  const optional: [keyof Endpoints, string][] = [
    ["jwks", "jwks_uri"],
    ["userinfo", "userinfo_endpoint"],
    ["revoke", "revocation_endpoint"],
    ["endSession", "end_session_endpoint"],
    ["introspect", "introspection_endpoint"],
  ];
  for (const [name, key] of optional) {
    const value = url(key, false);
    if (value !== undefined) {
      endpoints[name] = value;
    }
  }

  const grants = list("grant_types_supported") ?? [...DEFAULT_GRANTS];
  const challenges = list("code_challenge_methods_supported") ?? [];

  return {
    id,
    issuer,
    endpoints,
    caps: {
      code: grants.includes("authorization_code"),
      pkce: challenges.includes("S256"),
      refresh: grants.includes("refresh_token"),
      revoke: endpoints.revoke !== undefined,
      endSession: endpoints.endSession !== undefined,
      userinfo: endpoints.userinfo !== undefined,
    },
    scopes: list("scopes_supported") ?? [],
    claims: list("claims_supported") ?? [],
  };
};
