import { describe, expect, it } from "vitest";

import { assemble } from "../src/assemble";
import { describe as manifest } from "../src/describe";
import { InvalidDocumentError } from "../src/error";
import { lower } from "../src/claims";
import { verify } from "../src/verify";
import type { Claims, Issuer, Resource } from "../src/types";

const resource: Resource = {
  resource: "https://app.example",
  authorization_servers: ["https://accounts.google.com"],
  scopes_supported: ["docs:read", "docs:write"],
};

const claims: Claims = {
  requested: [
    { name: "email", essential: true },
    { name: "roles", essential: true, values: ["admin", "editor"] },
    { name: "plan", essential: true, values: ["free", "pro"] },
    { name: "tenant", essential: false },
  ],
  roles: ["admin", "editor"],
  groups: [],
  entitlements: [],
  profile: ["email"],
  meta: { plan: ["free", "pro"], tenant: "string?" },
};

const google: Issuer = {
  id: "google",
  issuer: "https://accounts.google.com",
  endpoints: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    jwks: "https://www.googleapis.com/oauth2/v3/certs",
    revoke: "https://oauth2.googleapis.com/revoke",
  },
  caps: {
    code: true,
    pkce: true,
    refresh: true,
    revoke: true,
    endSession: false,
    userinfo: false,
  },
  scopes: ["openid", "email", "profile"],
  claims: ["sub", "email", "name"],
};

describe("assemble", () => {
  it("builds and proves the contract from the documents", () => {
    const { contract, schema } = assemble(resource, claims);
    expect(contract).toEqual({
      scopes: ["docs:read", "docs:write"],
      roles: ["admin", "editor"],
      groups: [],
      entitlements: [],
      meta: { plan: ["free", "pro"], tenant: "string?" },
    });
    expect(schema.check.user({ sub: "u", meta: { plan: "pro" } })).toBe(true);
  });

  it("builds empty vocabularies without a claims request", () => {
    expect(assemble(resource).contract).toEqual({
      scopes: ["docs:read", "docs:write"],
      roles: [],
      groups: [],
      entitlements: [],
      meta: {},
    });
  });

  it("names the path when the assembled contract fails the schema", () => {
    const broken = { ...claims, roles: ["admin", "admin"] };
    expect(() => assemble(resource, broken)).toThrow(InvalidDocumentError);
    expect(() => assemble(resource, broken)).toThrow(/roles\.1/);
  });
});

describe("lower", () => {
  it("lowers a requested claim to a field", () => {
    expect(lower({ name: "a", essential: true }, "string")).toBe("string");
    expect(lower({ name: "a", essential: false }, "number[]")).toBe(
      "number[]?",
    );
    expect(
      lower({ name: "a", essential: true, values: ["x"] }, "string"),
    ).toEqual(["x"]);
    expect(
      lower({ name: "a", essential: false, values: [1] }, "string"),
    ).toEqual({ values: [1], optional: true });
  });
});

describe("describe", () => {
  it("describes the contract with titled names and the given descriptions", () => {
    const { contract } = assemble(resource, claims);
    const described = manifest(contract, claims, {
      scopes: { "docs:read": "Read documents" },
      roles: { admin: "Full control" },
    });
    expect(described.scopes).toEqual([
      { id: "docs:read", name: "Docs Read", description: "Read documents" },
      { id: "docs:write", name: "Docs Write" },
    ]);
    expect(described.roles).toEqual([
      { id: "admin", name: "Admin", description: "Full control" },
      { id: "editor", name: "Editor" },
    ]);
    expect(described.claims).toEqual([
      { id: "email", name: "Email", essential: true },
      {
        id: "roles",
        name: "Roles",
        essential: true,
        values: ["admin", "editor"],
      },
      { id: "plan", name: "Plan", essential: true, values: ["free", "pro"] },
      { id: "tenant", name: "Tenant", essential: false },
    ]);
  });

  it("derives a manifest from a bare contract", () => {
    const described = manifest(assemble(resource).contract);
    expect(described.scopes.map((entry) => entry.id)).toEqual([
      "docs:read",
      "docs:write",
    ]);
    expect(described.claims).toEqual([]);
  });
});

describe("verify", () => {
  it("is quiet when the documents agree", () => {
    expect(verify(resource, undefined, [google])).toEqual([]);
  });

  it("says what the bridge must supply", () => {
    const warnings = verify(resource, claims, [google]);
    expect(warnings).toEqual([
      expect.stringMatching(/does not publish roles; the bridge must supply/),
      expect.stringMatching(/does not publish plan; the bridge must supply/),
      expect.stringMatching(/does not publish tenant; the bridge must supply/),
    ]);
  });

  it("flags a standard claim the issuer does not publish", () => {
    const warnings = verify(
      resource,
      { ...claims, requested: [{ name: "locale", essential: false }] },
      [google],
    );
    expect(warnings).toEqual([
      expect.stringMatching(
        /standard claim locale; the bridge may find it absent/,
      ),
    ]);
  });

  it("flags issuers and servers that do not line up", () => {
    const other: Issuer = {
      ...google,
      id: "other",
      issuer: "https://other.example",
      endpoints: { authorize: "https://o/a", token: "https://o/t" },
      caps: {
        code: false,
        pkce: false,
        refresh: false,
        revoke: false,
        endSession: false,
        userinfo: false,
      },
      claims: [],
    };
    const warnings = verify(resource, claims, [other]);
    expect(warnings).toEqual([
      expect.stringMatching(
        /accounts\.google\.com is listed in the resource document but no issuer/,
      ),
      expect.stringMatching(/other .* is not listed in the resource document/),
      expect.stringMatching(/does not support the authorization code grant/),
      expect.stringMatching(/does not support PKCE/),
      expect.stringMatching(/does not support the refresh token grant/),
      expect.stringMatching(/publishes no jwks_uri/),
    ]);
  });
});
