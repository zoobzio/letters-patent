import { defineConfig } from "../../src/build";

export default defineConfig({
  resource: "./resource.json",
  claims: "./claims.json",
  issuers: { google: "./issuers/google.json" },
  openapi: "./openapi.json",
  describe: {
    roles: { admin: "Full control" },
    claims: { plan: "The billing plan" },
  },
  types: { seat: "number", tags: "string[]" },
  outDir: ".generated/patent",
});
