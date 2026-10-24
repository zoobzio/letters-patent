import { describe, expect, expectTypeOf, it } from "vitest";

import { defineSchema } from "letters-patent";

import config, { type Contract, type User } from "../.dist/config.mjs";
import {
  entitlements,
  groups,
  isGroup,
  isScope,
  roles,
  scopes,
} from "../.dist/index.mjs";
import google, { type Claims } from "../.dist/issuers/google.mjs";
import { issuers } from "../.dist/issuers.mjs";
import { manifest } from "../.dist/manifest.mjs";

describe("the built contract", () => {
  it("carries the vocabularies of the documents", () => {
    expect(scopes).toEqual(["docs:read", "docs:write", "billing:manage"]);
    expect(roles).toEqual(["admin", "editor", "viewer"]);
    expect(groups).toEqual(["engineering", "sales"]);
    expect(entitlements).toEqual(["beta", "export"]);
    expect(isScope("docs:read")).toBe(true);
    expect(isScope("docs:delete")).toBe(false);
    expect(isGroup("sales")).toBe(true);
    expect(config.contract.meta).toEqual({
      plan: ["free", "team", "enterprise"],
      workspace: "string",
      locale: "string?",
    });
  });

  it("types the user by the documents", () => {
    expectTypeOf<Contract["scopes"]>().toEqualTypeOf<
      readonly ["docs:read", "docs:write", "billing:manage"]
    >();
    expectTypeOf<User["meta"]["plan"]>().toEqualTypeOf<
      "free" | "team" | "enterprise"
    >();
    expectTypeOf<User["meta"]["locale"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Claims["email_verified"]>().toEqualTypeOf<
      boolean | undefined
    >();
  });

  it("derives a schema that rules a user", () => {
    const schema = defineSchema<Contract>(config.contract);
    expect(
      schema.check.user({
        sub: "u",
        roles: ["editor"],
        meta: { plan: "team", workspace: "acme" },
      }),
    ).toBe(true);
    expect(
      schema.check.user({ sub: "u", roles: ["owner"], meta: { plan: "team" } }),
    ).toBe(false);
  });

  it("describes itself for an interface", () => {
    expect(manifest.scopes[0]).toEqual({
      id: "docs:read",
      name: "Docs Read",
      description: "Read documents",
    });
    expect(manifest.roles[0]?.description).toBe(
      "Full control of the workspace",
    );
    expect(manifest.claims.find((claim) => claim.id === "plan")).toEqual({
      id: "plan",
      name: "Plan",
      description: "The billing plan the workspace is on",
      essential: true,
      values: ["free", "team", "enterprise"],
    });
  });

  it("knows its issuer", () => {
    expect(issuers).toEqual([
      { id: "google", issuer: "https://accounts.google.com" },
    ]);
    expect(google.endpoints.authorize).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(google.caps.refresh).toBe(true);
    expectTypeOf(google.caps.refresh).toEqualTypeOf<true>();
    expectTypeOf(google.caps.endSession).toEqualTypeOf<false>();
  });
});
