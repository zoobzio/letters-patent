import { describe, expect, it } from "vitest";
import type { Contract } from "../src/index";
import { SchemaError, defineSchema } from "../src/index";

const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["admin", "editor"],
  groups: ["eng", "sales"],
  entitlements: ["beta"],
  meta: {
    plan: ["free", "pro"],
    org: "string",
    age: "number?",
    beta: "boolean?",
    tags: "string[]?",
    tier: { values: [1, 2, 3], optional: true },
  },
});

const ada = {
  sub: "user-1",
  scopes: ["docs:read"],
  roles: ["editor"],
  groups: ["eng"],
  entitlements: [],
  meta: { plan: "pro", org: "zoobz" },
};

describe("defineSchema", () => {
  it("rejects a malformed contract at construction", () => {
    // A structurally mangled cast fails derivation before the assert runs.
    expect(() =>
      defineSchema({ scopes: ["a"], roles: [] } as unknown as Contract),
    ).toThrow();
    expect(() =>
      defineSchema({
        scopes: ["a", "a"],
        roles: [],
        groups: [],
        entitlements: [],
        meta: {},
      }),
    ).toThrow(SchemaError);
    expect(() =>
      defineSchema({
        scopes: [],
        roles: [],
        groups: [],
        entitlements: [],
        meta: { plan: "text" as never },
      }),
    ).toThrow(SchemaError);
    expect(() =>
      defineSchema({
        scopes: [],
        roles: [],
        groups: [],
        entitlements: [],
        meta: { plan: [] as never },
      }),
    ).toThrow(SchemaError);
  });

  it("derives the vocabulary sets", () => {
    expect(schema.enums.scopes).toEqual(new Set(["docs:read", "docs:write"]));
    expect(schema.enums.roles).toEqual(new Set(["admin", "editor"]));
    expect(schema.enums.groups).toEqual(new Set(["eng", "sales"]));
    expect(schema.enums.entitlements).toEqual(new Set(["beta"]));
    expect(schema.enums.meta).toEqual(
      new Set(["plan", "org", "age", "beta", "tags", "tier"]),
    );
    expect(schema.base.scopes).toEqual(["docs:read", "docs:write"]);
  });

  it("infers the vocabulary types from the contract", () => {
    // Compile-time proof: the parsed values are literal unions, not string.
    const scope: "docs:read" | "docs:write" = schema.parse.scope("docs:read");
    const role: "admin" | "editor" = schema.parse.role("editor");
    const group: "eng" | "sales" = schema.parse.group("eng");
    const entitlement: "beta" = schema.parse.entitlement("beta");
    const meta = schema.parse.meta({ plan: "free", org: "zoobz" });
    const plan: "free" | "pro" = meta.plan;
    const age: number | undefined = meta.age;
    const tags: string[] | undefined = meta.tags;
    const tier: 1 | 2 | 3 | undefined = meta.tier;
    expect([scope, role, group, entitlement, plan, age, tags, tier]).toEqual([
      "docs:read",
      "editor",
      "eng",
      "beta",
      "free",
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("contract kind", () => {
  it("gates untrusted contract data", () => {
    expect(schema.check.contract(schema.base)).toBe(true);
    expect(
      schema.check.contract({
        scopes: [],
        roles: [],
        groups: [],
        entitlements: [],
        meta: {},
      }),
    ).toBe(true);
    expect(schema.check.contract({ scopes: [], roles: [], meta: {} })).toBe(
      false,
    );
    expect(schema.check.contract(null)).toBe(false);
  });

  it("reports declaration issues with their paths", () => {
    const result = schema.inspect.contract({
      scopes: ["a", "a"],
      roles: [7],
      groups: [],
      entitlements: [""],
      meta: { plan: "text" },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "duplicate", path: ["scopes", 1] }),
      expect.objectContaining({ code: "not_string", path: ["roles", 0] }),
      expect.objectContaining({ code: "empty", path: ["entitlements", 0] }),
      expect.objectContaining({ code: "not_field", path: ["meta", "plan"] }),
    ]);
  });
});

describe("member kinds", () => {
  it("accepts declared members", () => {
    expect(schema.check.scope("docs:write")).toBe(true);
    expect(schema.check.role("admin")).toBe(true);
    expect(schema.check.group("sales")).toBe(true);
    expect(schema.check.entitlement("beta")).toBe(true);
  });

  it("rejects undeclared members and non-strings", () => {
    expect(schema.check.scope("docs:delete")).toBe(false);
    expect(schema.check.role(42)).toBe(false);
    expect(schema.check.group("ops")).toBe(false);
    expect(schema.check.entitlement("alpha")).toBe(false);
    const result = schema.inspect.scope("docs:delete");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "not_member",
        expected: ["docs:read", "docs:write"],
      }),
    ]);
  });
});

describe("list kinds", () => {
  it("accepts lists drawn from the vocabulary", () => {
    expect(schema.check.scopes([])).toBe(true);
    expect(schema.check.scopes(["docs:read", "docs:write"])).toBe(true);
    expect(schema.check.roles(["editor"])).toBe(true);
    expect(schema.check.groups(["eng", "sales"])).toBe(true);
    expect(schema.check.entitlements(["beta"])).toBe(true);
  });

  it("points at the undeclared entry", () => {
    const result = schema.inspect.scopes(["docs:read", "docs:delete"]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "not_member", path: [1] }),
    ]);
  });
});

describe("meta kind", () => {
  it("accepts a construction matching the declarations", () => {
    expect(schema.check.meta({ plan: "free", org: "zoobz" })).toBe(true);
    expect(
      schema.check.meta({
        plan: "pro",
        org: "zoobz",
        age: 42,
        beta: true,
        tags: ["a", "b"],
        tier: 2,
      }),
    ).toBe(true);
  });

  it("treats ?-suffixed fields and optional choices as optional", () => {
    expect(schema.check.meta({ plan: "free", org: "zoobz" })).toBe(true);
    expect(
      schema.check.meta({
        plan: "free",
        org: "zoobz",
        age: undefined,
        tier: undefined,
      }),
    ).toBe(true);
  });

  it("requires plain and enum fields", () => {
    const result = schema.inspect.meta({ age: 42 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "missing", expected: ["plan", "org"] }),
    ]);
  });

  it("rejects members outside the declarations", () => {
    const result = schema.inspect.meta({
      plan: "free",
      org: "zoobz",
      extra: "gold",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "unknown" }),
    ]);
  });

  it("rules each member by its declaration", () => {
    const result = schema.inspect.meta({
      plan: "gold",
      org: 7,
      age: "old",
      tags: ["a", 1],
      tier: 9,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "not_member", path: ["plan"] }),
      expect.objectContaining({ code: "not_string", path: ["org"] }),
      expect.objectContaining({ code: "not_number", path: ["age"] }),
      expect.objectContaining({ code: "not_string", path: ["tags", 1] }),
      expect.objectContaining({ code: "not_member", path: ["tier"] }),
    ]);
  });
});

describe("user kind", () => {
  it("accepts a user inside the contract", () => {
    expect(schema.check.user(ada)).toBe(true);
    expect(schema.parse.user(ada)).toBe(ada);
  });

  it("reads absent grants as none", () => {
    expect(schema.check.user({ sub: "u", meta: ada.meta })).toBe(true);
  });

  it("rejects grants outside the vocabulary, with the path", () => {
    const result = schema.inspect.user({
      ...ada,
      scopes: ["docs:read", "docs:delete"],
      groups: ["ops"],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "not_member", path: ["scopes", 1] }),
      expect.objectContaining({ code: "not_member", path: ["groups", 0] }),
    ]);
  });

  it("rules the meta construction in place", () => {
    const result = schema.inspect.user({ ...ada, meta: { plan: "free" } });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "missing",
        path: ["meta"],
        expected: ["plan", "org"],
      }),
    ]);
  });

  it("accepts the standard claims", () => {
    expect(
      schema.check.user({
        ...ada,
        email: "ada@example.com",
        email_verified: true,
        name: "Ada",
        preferred_username: "ada",
        picture: "https://example.com/ada.png",
        iat: 1740000000,
        exp: 1750000000,
      }),
    ).toBe(true);
  });

  it("rejects non-objects and missing members", () => {
    expect(schema.check.user(null)).toBe(false);
    expect(schema.check.user("user")).toBe(false);
    expect(schema.check.user({ sub: "u", scopes: [], roles: [] })).toBe(false);
    expect(schema.check.user({ scopes: [], roles: [], meta: {} })).toBe(false);
  });

  it("still rules the standard claims", () => {
    expect(schema.check.user({ ...ada, sub: "" })).toBe(false);
    expect(schema.check.user({ ...ada, sub: "  " })).toBe(false);
    expect(schema.check.user({ ...ada, email: 42 })).toBe(false);
    expect(schema.check.user({ ...ada, email_verified: "yes" })).toBe(false);
    expect(schema.check.user({ ...ada, name: {} })).toBe(false);
    expect(schema.check.user({ ...ada, preferred_username: 7 })).toBe(false);
    expect(schema.check.user({ ...ada, picture: [] })).toBe(false);
    expect(schema.check.user({ ...ada, iat: "yesterday" })).toBe(false);
    expect(schema.check.user({ ...ada, exp: "tomorrow" })).toBe(false);
  });
});
