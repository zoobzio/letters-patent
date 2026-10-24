import { defineConfig } from "../../src/build";

export default defineConfig({
  resource: "./resource.json",
  claims: "./claims.json",
  issuers: { google: "./issuers/google.json" },
  describe: {
    scopes: { "docs:read": "Read documents" },
    roles: { admin: "Full control" },
    claims: { plan: "The billing plan" },
  },
  types: { seat: "number", tags: "string[]" },
  outDir: ".generated/patent",
});
