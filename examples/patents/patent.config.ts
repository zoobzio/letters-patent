import { defineConfig } from "@letters-patent/kit";

/**
 * The build of the Acme contract. The app is an OAuth 2.0 protected
 * resource: `resource.json` is its metadata (RFC 9728) and names its
 * scopes; the claims request names what the app requires of a user and its
 * `roles`, `groups`, and `entitlements` vocabularies; the OpenAPI document
 * describes the scopes; Google is the issuer, from a vendored discovery
 * document. The build writes to `.dist/`, and the package exports the
 * modules, so an app names this package as its preset.
 */
export default defineConfig({
  resource: "./src/resource.json",
  claims: "./src/claims.json",
  issuers: { google: "./src/issuers/google.json" },
  openapi: "./src/openapi.json",
  describe: {
    roles: {
      admin: "Full control of the workspace",
      editor: "Edit documents",
      viewer: "Read documents",
    },
    groups: { engineering: "The engineering team", sales: "The sales team" },
    entitlements: {
      beta: "Early access to features in the works",
      export: "Export the workspace",
    },
    claims: {
      plan: "The billing plan the workspace is on",
      workspace: "The workspace slug",
    },
  },
  outDir: ".dist",
});
