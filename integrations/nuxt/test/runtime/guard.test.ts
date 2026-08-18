import { describe, expect, it, vi } from "vitest";
import type { Meta, User } from "letters-patent";
import type { Provider } from "letters-patent/kit";
import { defineCrest, defineSchema } from "letters-patent";

import { guard } from "../../src/runtime/guard";

const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["editor", "admin"],
  meta: { name: "string" },
});

type C = (typeof schema)["base"];

const ada = (overrides: Partial<User<Meta<C>>> = {}): User<Meta<C>> => ({
  id: "user-1",
  scopes: ["docs:read"],
  roles: ["editor"],
  meta: { name: "Ada" },
  ...overrides,
});

// The lifecycle is never driven here; the provider is inert.
const provider: Provider<C> = {
  login: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  resolve: vi.fn(async () => {}),
};

const service = (user: User<Meta<C>> | null) =>
  defineCrest(schema, provider, { current: user });

describe("guard", () => {
  it("turns away a visitor with no user", () => {
    expect(guard(service(null))).toBe("unauthenticated");
    expect(guard(service(null), { scopes: ["docs:read"] })).toBe(
      "unauthenticated",
    );
  });

  it("grants an authenticated user when the page has no requirements", () => {
    expect(guard(service(ada()))).toBe("granted");
    expect(guard(service(ada()), {})).toBe("granted");
    expect(guard(service(ada()), { scopes: [], roles: [] })).toBe("granted");
  });

  it("requires every listed scope", () => {
    expect(guard(service(ada()), { scopes: ["docs:read"] })).toBe("granted");
    expect(guard(service(ada()), { scopes: ["docs:read", "docs:write"] })).toBe(
      "denied",
    );
  });

  it("accepts any listed role", () => {
    expect(guard(service(ada()), { roles: ["admin", "editor"] })).toBe(
      "granted",
    );
    expect(guard(service(ada()), { roles: ["admin"] })).toBe("denied");
  });

  it("requires scopes and roles together", () => {
    const requirements = { scopes: ["docs:read"], roles: ["editor"] } as const;
    expect(guard(service(ada()), requirements)).toBe("granted");
    expect(guard(service(ada({ roles: [] })), requirements)).toBe("denied");
    expect(guard(service(ada({ scopes: [] })), requirements)).toBe("denied");
  });

  it("emits the service's denied event on a shortfall", () => {
    const auth = service(ada());
    const denied = vi.fn();
    auth.on("denied", denied);

    expect(guard(auth, { scopes: ["docs:write"] })).toBe("denied");
    expect(denied).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ check: "scope", required: ["docs:write"] }),
    );
  });
});
