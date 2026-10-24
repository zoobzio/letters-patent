import { describe, expect, it } from "vitest";
import {
  absent,
  at,
  container,
  each,
  field,
  filled,
  flag,
  keyword,
  list,
  literals,
  member,
  nest,
  numeric,
  optional,
  spec,
  subset,
  superset,
  text,
  unique,
} from "../src/util";

describe("nest", () => {
  it("prefixes an issue's path with the member key", () => {
    const issue = { code: "empty" as const, message: "Empty." };
    expect(nest("id", issue)).toEqual({
      code: "empty",
      message: "Empty.",
      path: ["id"],
    });
    expect(nest(0, nest("scopes", issue)).path).toEqual([0, "scopes"]);
  });
});

describe("container", () => {
  const rule = container("User");

  it("passes objects", () => {
    expect(rule({})).toBeUndefined();
  });

  it("rejects primitives, null, and arrays", () => {
    expect(rule("user")?.code).toBe("not_object");
    expect(rule(null)?.code).toBe("not_object");
    expect(rule([])?.code).toBe("not_object");
  });
});

describe("text", () => {
  const rule = text("Email");

  it("passes strings", () => {
    expect(rule("ada@example.com")).toBeUndefined();
    expect(rule("")).toBeUndefined();
  });

  it("rejects non-strings", () => {
    expect(rule(42)?.code).toBe("not_string");
    expect(rule(undefined)?.code).toBe("not_string");
  });
});

describe("filled", () => {
  const rule = filled("Identifier");

  it("passes non-empty strings and non-strings", () => {
    expect(rule("user-1")).toBeUndefined();
    expect(rule(42)).toBeUndefined();
  });

  it("rejects empty and whitespace-only strings", () => {
    expect(rule("")?.code).toBe("empty");
    expect(rule("   ")?.code).toBe("empty");
  });
});

describe("numeric", () => {
  const rule = numeric("Expiry");

  it("passes numbers", () => {
    expect(rule(1750000000000)).toBeUndefined();
  });

  it("rejects non-numbers", () => {
    expect(rule("tomorrow")?.code).toBe("not_number");
    expect(rule(undefined)?.code).toBe("not_number");
  });
});

describe("flag", () => {
  const rule = flag("Verified");

  it("passes booleans", () => {
    expect(rule(true)).toBeUndefined();
    expect(rule(false)).toBeUndefined();
  });

  it("rejects non-booleans", () => {
    expect(rule("yes")?.code).toBe("not_boolean");
    expect(rule(1)?.code).toBe("not_boolean");
  });
});

describe("list", () => {
  const rule = list("Scopes", [text("Scope")]);

  it("passes arrays whose entries satisfy the rules", () => {
    expect(rule([])).toBeUndefined();
    expect(rule(["docs:read", "docs:write"])).toBeUndefined();
  });

  it("rejects non-arrays", () => {
    expect(rule("docs:read")?.code).toBe("not_array");
  });

  it("nests an entry's issue under its index", () => {
    expect(rule(["ok", 42])).toEqual(
      expect.objectContaining({ code: "not_string", path: [1] }),
    );
  });
});

describe("superset", () => {
  const rule = superset("User", ["sub", "meta"]);

  it("passes containers carrying every required member", () => {
    expect(rule({ sub: "u", meta: {}, extra: true })).toBeUndefined();
  });

  it("yields to the container rule on non-containers", () => {
    expect(rule("user")).toBeUndefined();
  });

  it("reports every missing member in one issue", () => {
    expect(rule({})).toEqual(
      expect.objectContaining({
        code: "missing",
        expected: ["sub", "meta"],
      }),
    );
    expect(rule({})?.message).toContain("sub, meta");
  });
});

describe("member", () => {
  const rule = member("Scope", new Set(["docs:read", "docs:write"]));

  it("passes declared members and yields on non-strings", () => {
    expect(rule("docs:read")).toBeUndefined();
    expect(rule(42)).toBeUndefined();
  });

  it("rules a numeric set by numbers", () => {
    const tiers = member("Tier", new Set([1, 2]));
    expect(tiers(2)).toBeUndefined();
    expect(tiers("1")).toBeUndefined();
    expect(tiers(3)?.code).toBe("not_member");
  });

  it("rejects undeclared members", () => {
    expect(rule("docs:delete")).toEqual(
      expect.objectContaining({
        code: "not_member",
        expected: ["docs:read", "docs:write"],
      }),
    );
  });
});

describe("unique", () => {
  const rule = unique("Scopes");

  it("passes distinct entries and yields on non-arrays", () => {
    expect(rule(["a", "b"])).toBeUndefined();
    expect(rule("a")).toBeUndefined();
  });

  it("rejects a repeated entry under its index", () => {
    expect(rule(["a", "b", "a"])).toEqual(
      expect.objectContaining({ code: "duplicate", path: [2] }),
    );
  });
});

describe("subset", () => {
  const rule = subset("Meta", new Set(["plan", "org"]));

  it("passes declared members and yields on non-containers", () => {
    expect(rule({ plan: "free" })).toBeUndefined();
    expect(rule("meta")).toBeUndefined();
  });

  it("reports every stray member in one issue", () => {
    expect(rule({ plan: "free", tier: 1, extra: true })).toEqual(
      expect.objectContaining({ code: "unknown" }),
    );
    expect(rule({ tier: 1, extra: true })?.message).toContain("tier, extra");
  });
});

describe("each", () => {
  const rule = each([text("Field")]);

  it("passes when every member satisfies the rules", () => {
    expect(rule({ a: "x", b: "y" })).toBeUndefined();
    expect(rule("no")).toBeUndefined();
  });

  it("nests a member's issue under its key", () => {
    expect(rule({ a: "x", b: 2 })).toEqual(
      expect.objectContaining({ code: "not_string", path: ["b"] }),
    );
  });
});

describe("at", () => {
  const rule = at("sub", [text("Subject"), filled("Subject")]);

  it("runs the rules against the member", () => {
    expect(rule({ sub: "user-1" })).toBeUndefined();
  });

  it("yields on non-containers and absent members", () => {
    expect(rule("user")).toBeUndefined();
    expect(rule({})).toBeUndefined();
  });

  it("nests the member's first issue under its key", () => {
    expect(rule({ sub: 42 })).toEqual(
      expect.objectContaining({ code: "not_string", path: ["sub"] }),
    );
    expect(rule({ sub: "" })).toEqual(
      expect.objectContaining({ code: "empty", path: ["sub"] }),
    );
  });
});

describe("spec", () => {
  const rule = spec("Meta field");

  it("passes scalar keywords, literal enums, and choices", () => {
    expect(rule("string")).toBeUndefined();
    expect(rule("number?")).toBeUndefined();
    expect(rule("string[]")).toBeUndefined();
    expect(rule("number[]?")).toBeUndefined();
    expect(rule(["free", "pro"])).toBeUndefined();
    expect(rule([1, 2, 3])).toBeUndefined();
    expect(rule({ values: ["free", "pro"] })).toBeUndefined();
    expect(rule({ values: [1, 2], optional: true })).toBeUndefined();
  });

  it("rejects unknown keywords and non-declarations", () => {
    expect(rule("text")?.code).toBe("not_field");
    expect(rule("string[]?[]")?.code).toBe("not_field");
    expect(rule(42)?.code).toBe("not_field");
    expect(rule({})?.code).toBe("not_field");
    expect(rule(null)?.code).toBe("not_field");
  });

  it("rejects empty enums and malformed literals", () => {
    expect(rule([])?.code).toBe("empty");
    expect(rule(["free", 2])).toEqual(
      expect.objectContaining({ code: "not_string", path: [1] }),
    );
    expect(rule([1, "2"])).toEqual(
      expect.objectContaining({ code: "not_number", path: [1] }),
    );
    expect(rule(["free", " "])).toEqual(
      expect.objectContaining({ code: "empty", path: [1] }),
    );
  });

  it("rules a choice's members", () => {
    expect(rule({ values: [] })).toEqual(
      expect.objectContaining({ code: "empty", path: ["values"] }),
    );
    expect(rule({ values: "free" })).toEqual(
      expect.objectContaining({ code: "not_array", path: ["values"] }),
    );
    expect(rule({ values: ["free"], optional: "yes" })).toEqual(
      expect.objectContaining({ code: "not_boolean", path: ["optional"] }),
    );
    expect(rule({ values: ["free"], extra: true })?.code).toBe("unknown");
  });
});

describe("field", () => {
  it("rules scalars by their keyword", () => {
    expect(field("org", "string")("zoobz")).toBeUndefined();
    expect(field("org", "string")(7)?.code).toBe("not_string");
    expect(field("age", "number")(42)).toBeUndefined();
    expect(field("age", "number")("old")?.code).toBe("not_number");
    expect(field("beta", "boolean")(true)).toBeUndefined();
    expect(field("beta", "boolean")("yes")?.code).toBe("not_boolean");
  });

  it("admits undefined only for ?-suffixed forms", () => {
    expect(field("age", "number?")(undefined)).toBeUndefined();
    expect(field("age", "number?")("old")?.code).toBe("not_number");
    expect(field("age", "number")(undefined)?.code).toBe("not_number");
  });

  it("rules multi-valued keywords as lists", () => {
    expect(field("tags", "string[]")(["a", "b"])).toBeUndefined();
    expect(field("tags", "string[]")("a")?.code).toBe("not_array");
    expect(field("tags", "string[]")(["a", 1])?.path).toEqual([1]);
    expect(field("ids", "number[]?")(undefined)).toBeUndefined();
    expect(field("ids", "number[]?")([1, "2"])?.code).toBe("not_number");
  });

  it("rules enums by membership", () => {
    const rule = field("plan", ["free", "pro"]);
    expect(rule("pro")).toBeUndefined();
    expect(rule("gold")?.code).toBe("not_member");
    expect(rule(7)?.code).toBe("not_string");
    expect(rule(undefined)?.code).toBe("not_string");

    const tier = field("tier", [1, 2, 3]);
    expect(tier(2)).toBeUndefined();
    expect(tier(4)?.code).toBe("not_member");
    expect(tier("2")?.code).toBe("not_number");
  });

  it("rules choices by membership, optional when marked", () => {
    const required = field("plan", { values: ["free", "pro"] });
    expect(required("free")).toBeUndefined();
    expect(required(undefined)?.code).toBe("not_string");

    const optional = field("plan", { values: ["free", "pro"], optional: true });
    expect(optional(undefined)).toBeUndefined();
    expect(optional("gold")?.code).toBe("not_member");
  });
});

describe("optional", () => {
  const rules = optional([text("Email")]);

  it("passes undefined through every rule", () => {
    expect(rules.map((rule) => rule(undefined))).toEqual([undefined]);
  });

  it("applies the rules once a value is present", () => {
    expect(rules[0]?.("ada@example.com")).toBeUndefined();
    expect(rules[0]?.(42)?.code).toBe("not_string");
  });
});

describe("declaration readers", () => {
  it("reads the keyword of a scalar declaration", () => {
    expect(keyword("string")).toBe("string");
    expect(keyword("number[]?")).toBe("number[]");
    expect(keyword("text")).toBeUndefined();
    expect(keyword(["a"])).toBeUndefined();
  });

  it("reads whether a declaration is optional", () => {
    expect(absent("string")).toBe(false);
    expect(absent("string?")).toBe(true);
    expect(absent(["a", "b"])).toBe(false);
    expect(absent({ values: ["a"] })).toBe(false);
    expect(absent({ values: ["a"], optional: true })).toBe(true);
  });

  it("reads the literals of an enum or choice", () => {
    expect(literals("string")).toBeUndefined();
    expect(literals(["a", "b"])).toEqual(["a", "b"]);
    expect(literals({ values: [1, 2] })).toEqual([1, 2]);
  });
});
