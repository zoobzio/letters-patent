import type { Claims, Issuer, Resource } from "./types";

import { PROFILE_CLAIMS, STANDARD_CLAIMS } from "./standard";

/**
 * Cross-checks the documents against each other and reports what falls
 * short of an error. Nothing here can fail the build: an issuer that does
 * not publish a claim may still issue it, and an app's own scopes are never
 * the issuer's to know. The warnings tell the author what the bridge must
 * supply and what the provider cannot rely on.
 *
 * @param resource - The Protected Resource Metadata.
 * @param claims - The claims request, when the config has one.
 * @param issuers - The issuers read from their discovery documents.
 */
export const verify = (
  resource: Resource,
  claims: Claims | undefined,
  issuers: Issuer[],
): string[] => {
  const warnings: string[] = [];
  const known = new Set(issuers.map((issuer) => issuer.issuer));

  for (const server of resource.authorization_servers) {
    if (!known.has(server)) {
      warnings.push(
        `authorization server ${server} is listed in the resource document but no issuer in the config publishes it`,
      );
    }
  }

  for (const issuer of issuers) {
    if (!resource.authorization_servers.includes(issuer.issuer)) {
      warnings.push(
        `issuer ${issuer.id} (${issuer.issuer}) is not listed in the resource document's authorization_servers`,
      );
    }
    if (!issuer.caps.code) {
      warnings.push(
        `issuer ${issuer.id} does not support the authorization code grant`,
      );
    }
    if (!issuer.caps.pkce) {
      warnings.push(`issuer ${issuer.id} does not support PKCE with S256`);
    }
    if (!issuer.caps.refresh) {
      warnings.push(
        `issuer ${issuer.id} does not support the refresh token grant; a provider cannot implement refresh against it`,
      );
    }
    if (issuer.endpoints.jwks === undefined) {
      warnings.push(
        `issuer ${issuer.id} publishes no jwks_uri; a provider cannot verify its tokens locally`,
      );
    }

    if (claims === undefined || issuer.claims.length === 0) {
      continue;
    }
    const published = new Set(issuer.claims);
    for (const claim of claims.requested) {
      if (published.has(claim.name)) {
        continue;
      }
      const standard =
        PROFILE_CLAIMS.has(claim.name) || claim.name in STANDARD_CLAIMS;
      warnings.push(
        standard
          ? `issuer ${issuer.id} does not publish the standard claim ${claim.name}; the bridge may find it absent`
          : `issuer ${issuer.id} does not publish ${claim.name}; the bridge must supply it from the app's own records`,
      );
    }
  }

  return warnings;
};
