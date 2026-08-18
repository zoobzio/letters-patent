import { describe, expect, it, vi } from "vitest";
import type { Meta, User } from "letters-patent";
import type { Provider } from "letters-patent/kit";
import type { H3Event } from "h3";
import { SchemaError, defineSchema } from "letters-patent";

// The handler only uses these three h3 helpers; stub them so the dispatcher
// can be driven with a plain fake event. `defineEventHandler` becomes
// identity, so the returned handler is the raw async function.
vi.mock("h3", () => ({
  defineEventHandler: (fn: unknown) => fn,
  getRouterParam: (event: FakeEvent, name: string) => event.params[name],
  createError: (opts: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(opts.statusMessage), opts),
}));

import { defineAuthHandlers } from "../../src/server/handlers";

const schema = defineSchema({
  scopes: ["docs:read"],
  roles: ["editor"],
  meta: { name: "string" },
});

type C = (typeof schema)["base"];

interface FakeEvent {
  params: Record<string, string>;
}

const ada = (): User<Meta<C>> => ({
  id: "user-1",
  scopes: ["docs:read"],
  roles: ["editor"],
  meta: { name: "Ada" },
});

function fakeProvider(overrides: Partial<Provider<C>> = {}): Provider<C> {
  return {
    login: vi.fn(async (state) => {
      state.current = ada();
    }),
    logout: vi.fn(async () => {}),
    resolve: vi.fn(async (state) => {
      state.current = ada();
    }),
    ...overrides,
  };
}

function handlers(provider: Provider<C>) {
  const construct = vi.fn(() => provider);
  // The h3 mock makes defineEventHandler identity, so the handler is
  // callable directly with a fake event.
  const handle = defineAuthHandlers(
    schema,
    construct as unknown as (event: H3Event) => Provider<C>,
  ) as unknown as (event: FakeEvent) => Promise<unknown>;
  return { handle, construct };
}

function event(action: string): FakeEvent {
  return { params: { action } };
}

describe("defineAuthHandlers", () => {
  it("constructs the provider per request with the event", async () => {
    const { handle, construct } = handlers(fakeProvider());

    await handle(event("session"));
    expect(construct).toHaveBeenCalledExactlyOnceWith(event("session"));
  });

  it("session answers with the resolved user", async () => {
    const provider = fakeProvider();
    const { handle } = handlers(provider);

    await expect(handle(event("session"))).resolves.toEqual(ada());
    expect(provider.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ current: ada() }),
      schema,
    );
  });

  it("session answers null when unauthenticated", async () => {
    const provider = fakeProvider({ resolve: vi.fn(async () => {}) });
    const { handle } = handlers(provider);

    await expect(handle(event("session"))).resolves.toBeNull();
  });

  it("login answers with the established user", async () => {
    const provider = fakeProvider();
    const { handle } = handlers(provider);

    await expect(handle(event("login"))).resolves.toEqual(ada());
    expect(provider.login).toHaveBeenCalledOnce();
  });

  it("login answers null for an out-of-band flow", async () => {
    const provider = fakeProvider({ login: vi.fn(async () => {}) });
    const { handle } = handlers(provider);

    await expect(handle(event("login"))).resolves.toBeNull();
  });

  it("logout tears down the resolved session and answers null", async () => {
    const provider = fakeProvider();
    const { handle } = handlers(provider);

    await expect(handle(event("logout"))).resolves.toBeNull();
    expect(provider.resolve).toHaveBeenCalledOnce();
    expect(provider.logout).toHaveBeenCalledOnce();
  });

  it("logout skips the provider when there is no session", async () => {
    const provider = fakeProvider({ resolve: vi.fn(async () => {}) });
    const { handle } = handlers(provider);

    await expect(handle(event("logout"))).resolves.toBeNull();
    expect(provider.logout).not.toHaveBeenCalled();
  });

  it("refresh revalidates the resolved session", async () => {
    const provider = fakeProvider({
      refresh: vi.fn(async (state) => {
        state.current = { ...ada(), expires: 2000 };
      }),
    });
    const { handle } = handlers(provider);

    await expect(handle(event("refresh"))).resolves.toEqual({
      ...ada(),
      expires: 2000,
    });
  });

  it("refresh answers the user unchanged when the provider omits refresh", async () => {
    const { handle } = handlers(fakeProvider());
    await expect(handle(event("refresh"))).resolves.toEqual(ada());
  });

  it("rejects a provider write that violates the contract", async () => {
    const provider = fakeProvider({
      resolve: vi.fn(async (state) => {
        state.current = { ...ada(), scopes: ["docs:admin"] };
      }),
    });
    const { handle } = handlers(provider);

    await expect(handle(event("session"))).rejects.toThrow(SchemaError);
  });

  it("rejects an unknown action with a 404", async () => {
    const { handle } = handlers(fakeProvider());
    await expect(handle(event("bogus"))).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
