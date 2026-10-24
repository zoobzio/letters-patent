import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { parseClaims } from "../src/claims";
import { parseDiscovery } from "../src/discovery";
import { InvalidDocumentError } from "../src/error";
import { parseOpenApi } from "../src/openapi";
import { parseResource } from "../src/resource";

const FIXTURES = new URL("./fixtures/", import.meta.url);

const fixture = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(name, FIXTURES), "utf8"));

describe("parseResource", () => {
  it("reads the resource, its servers, and its scopes, passing the rest through", async () => {
    const resource = parseResource(await fixture("resource.json"), "resource");
    expect(resource.resource).toBe("https://app.example");
    expect(resource.authorization_servers).toEqual([
      "https://accounts.google.com",
    ]);
    expect(resource.scopes_supported).toEqual(["docs:read", "docs:write"]);
    expect(resource.bearer_methods_supported).toEqual(["header"]);
  });

  it("defaults the optional members", () => {
    const resource = parseResource({ resource: "https://a.example" }, "r");
    expect(resource.authorization_servers).toEqual([]);
    expect(resource.scopes_supported).toEqual([]);
  });

  it("rejects a malformed document with the member at fault", () => {
    expect(() => parseResource(null, "r")).toThrow(InvalidDocumentError);
    expect(() => parseResource({}, "r")).toThrow(/resource: must name/);
    expect(() => parseResource({ resource: "app" }, "r")).toThrow(
      /absolute URL/,
    );
    expect(() =>
      parseResource(
        { resource: "https://a.example", scopes_supported: "x" },
        "r",
      ),
    ).toThrow(/scopes_supported/);
    expect(() =>
      parseResource(
        { resource: "https://a.example", scopes_supported: ["a", "a"] },
        "r",
      ),
    ).toThrow(/repeats scope a/);
    expect(() =>
      parseResource(
        { resource: "https://a.example", scopes_supported: ["a b"] },
        "r",
      ),
    ).toThrow(/single non-empty token/);
    expect(() =>
      parseResource(
        { resource: "https://a.example", authorization_servers: [1] },
        "r",
      ),
    ).toThrow(/authorization_servers/);
  });
});

describe("parseClaims", () => {
  it("reads the vocabularies, the profile claims, and the meta fields apart", async () => {
    const claims = parseClaims(await fixture("claims.json"), "claims", {
      seat: "number",
      tags: "string[]",
    });
    expect(claims.roles).toEqual(["admin", "editor"]);
    expect(claims.groups).toEqual(["eng", "sales"]);
    expect(claims.entitlements).toEqual(["beta"]);
    expect(claims.profile).toEqual([
      "email",
      "email_verified",
      "name",
      "picture",
    ]);
    expect(claims.meta).toEqual({
      plan: ["free", "pro"],
      org: "string",
      seat: { values: [1], optional: true },
      locale: "string?",
      tags: "string[]?",
    });
  });

  it("merges a claim requested under both sections", async () => {
    const claims = parseClaims(await fixture("claims.json"), "claims");
    const name = claims.requested.find((claim) => claim.name === "name");
    expect(name).toEqual({ name: "name", essential: true });
    expect(claims.requested.map((claim) => claim.name)).toContain("tags");
  });

  it("defaults a custom claim without values to a string", () => {
    const claims = parseClaims({ id_token: { tenant: null } }, "c");
    expect(claims.meta).toEqual({ tenant: "string?" });
    expect(
      parseClaims({ id_token: { tenant: { essential: true } } }, "c").meta,
    ).toEqual({ tenant: "string" });
  });

  it("types a standard claim from the table, a custom one from the config", () => {
    const claims = parseClaims(
      { userinfo: { updated_at: { essential: true }, amr: null, n: null } },
      "c",
      { n: "number" },
    );
    expect(claims.meta).toEqual({
      updated_at: "number",
      amr: "string[]?",
      n: "number?",
    });
  });

  it("rejects what a claims request cannot say", () => {
    const bad = (doc: unknown, pattern: RegExp) =>
      expect(() => parseClaims(doc, "c")).toThrow(pattern);
    bad(null, /JSON object/);
    bad({ access_token: {} }, /unknown section/);
    bad({ id_token: [] }, /object of claims/);
    bad({ id_token: { plan: "pro" } }, /null or an object/);
    bad({ id_token: { plan: { foo: 1 } } }, /unknown member foo/);
    bad(
      { id_token: { plan: { essential: "yes" } } },
      /essential: must be a boolean/,
    );
    bad({ id_token: { plan: { value: "a", values: ["a"] } } }, /not both/);
    bad({ id_token: { plan: { values: [] } } }, /non-empty array/);
    bad({ id_token: { plan: { values: ["a", 1] } } }, /non-empty strings/);
    bad({ id_token: { plan: { values: [1, "a"] } } }, /all be numbers/);
    bad({ id_token: { plan: { values: ["a", "a"] } } }, /repeats a/);
    bad(
      {
        id_token: { plan: { values: ["a"] } },
        userinfo: { plan: { values: ["b"] } },
      },
      /different values/,
    );
    bad({ id_token: { scope: null } }, /scope cannot be requested/);
    bad({ id_token: { iss: null } }, /token claim/);
    bad({ id_token: { address: null } }, /structured claim/);
    bad({ id_token: { roles: null } }, /roles must declare its vocabulary/);
    bad({ id_token: { roles: { values: [1] } } }, /string values/);
    bad({ id_token: { email: { values: ["a"] } } }, /member of the user/);
  });
});

describe("parseDiscovery", () => {
  it("reads the endpoints and capabilities", async () => {
    const issuer = parseDiscovery(
      await fixture("issuers/google.json"),
      "google",
      "google",
    );
    expect(issuer.id).toBe("google");
    expect(issuer.issuer).toBe("https://accounts.google.com");
    expect(issuer.endpoints).toEqual({
      authorize: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      jwks: "https://www.googleapis.com/oauth2/v3/certs",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
      revoke: "https://oauth2.googleapis.com/revoke",
    });
    expect(issuer.caps).toEqual({
      code: true,
      pkce: true,
      refresh: true,
      revoke: true,
      endSession: false,
      userinfo: true,
    });
    expect(issuer.scopes).toEqual(["openid", "email", "profile"]);
    expect(issuer.claims).toContain("email_verified");
  });

  it("applies the RFC 8414 defaults to a minimal document", () => {
    const issuer = parseDiscovery(
      {
        issuer: "https://as.example",
        authorization_endpoint: "https://as.example/authorize",
        token_endpoint: "https://as.example/token",
      },
      "as",
      "as",
    );
    expect(issuer.caps).toEqual({
      code: true,
      pkce: false,
      refresh: false,
      revoke: false,
      endSession: false,
      userinfo: false,
    });
    expect(issuer.endpoints.jwks).toBeUndefined();
    expect(issuer.scopes).toEqual([]);
    expect(issuer.claims).toEqual([]);
  });

  it("rejects a malformed document with the member at fault", () => {
    expect(() => parseDiscovery([], "a", "a")).toThrow(/JSON object/);
    expect(() => parseDiscovery({}, "a", "a")).toThrow(/issuer: is required/);
    expect(() =>
      parseDiscovery(
        { issuer: "https://a", authorization_endpoint: "nope" },
        "a",
        "a",
      ),
    ).toThrow(/authorization_endpoint: must be an absolute URL/);
    expect(() =>
      parseDiscovery(
        {
          issuer: "https://a",
          authorization_endpoint: "https://a/x",
          token_endpoint: "https://a/t",
          scopes_supported: "openid",
        },
        "a",
        "a",
      ),
    ).toThrow(/scopes_supported: must be an array/);
  });
});

describe("parseOpenApi", () => {
  it("reads the scope descriptions out of the oauth2 schemes", async () => {
    expect(parseOpenApi(await fixture("openapi.json"), "openapi")).toEqual({
      "docs:read": "Read documents",
      "docs:write": "Create and edit documents",
    });
  });

  it("reads a Swagger 2 document too, and tolerates no schemes", () => {
    expect(
      parseOpenApi(
        {
          securityDefinitions: {
            oauth: { type: "oauth2", scopes: { a: "A" } },
          },
        },
        "s",
      ),
    ).toEqual({ a: "A" });
    expect(parseOpenApi({ openapi: "3.1.0" }, "s")).toEqual({});
    expect(() => parseOpenApi("nope", "s")).toThrow(InvalidDocumentError);
  });
});
