import { describe, expect, it } from "vitest";
import type { Meta, User } from "@letters-patent/schema";
import { SchemaError, defineSchema } from "@letters-patent/schema";
import type { State } from "../src/index";
import { defineProvider } from "../src/index";

const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["editor"],
  meta: { plan: ["free", "pro"] },
});

type C = (typeof schema)["base"];

/* The vendor's world: what a fake auth API knows, contract-free. */
interface FakeOptions {
  session: FakeSession | null;
}

interface FakeSession {
  sub: string;
  grants: string[];
  groups: string[];
  plan: string;
}

const session: FakeSession = {
  sub: "user-1",
  grants: ["docs:read", "docs:write"],
  groups: ["editor"],
  plan: "pro",
};

/*
 * The published artifact: the implementation at the root Contract, the
 * app's contract reached only through the bridge.
 */
const createFakeProvider = defineProvider<FakeOptions, FakeSession>(
  (options, bridge) => ({
    login: async (state) => {
      if (options.session) {
        state.current = bridge(options.session);
      }
    },
    logout: async (state) => {
      state.current = null;
    },
    resolve: async (state) => {
      state.current = options.session ? bridge(options.session) : null;
    },
  }),
);

const ada: User<Meta<C>> = {
  id: "user-1",
  scopes: ["docs:read", "docs:write"],
  roles: ["editor"],
  meta: { plan: "pro" },
};

describe("defineProvider", () => {
  it("builds the provider in a single call, contract pinned by the schema", () => {
    // No explicit generic, no bridge annotation: C infers from the schema
    // and the bridge is contextually typed against it.
    const provider = createFakeProvider(schema, { session }, (payload) => ({
      id: payload.sub,
      scopes: payload.grants,
      roles: payload.groups,
      meta: { plan: payload.plan === "pro" ? "pro" : "free" },
    }));

    expect(provider.login).toBeTypeOf("function");
    expect(provider.logout).toBeTypeOf("function");
    expect(provider.resolve).toBeTypeOf("function");
    expect(provider.refresh).toBeUndefined();
  });

  it("rejects a bridge outside the contract at compile time", () => {
    const provider = createFakeProvider(schema, { session }, (payload) => ({
      id: payload.sub,
      scopes: payload.grants,
      roles: payload.groups,
      // @ts-expect-error — a mis-mapped meta fails to compile
      meta: { plan: payload.plan },
    }));

    expect(provider.resolve).toBeTypeOf("function");
  });

  it("threads options and bridge into the callbacks", async () => {
    const state: State<C> = { current: null };
    const bridge = (payload: FakeSession) => ({
      id: payload.sub,
      scopes: payload.grants,
      roles: payload.groups,
      meta: {
        plan: payload.plan === "pro" ? ("pro" as const) : ("free" as const),
      },
    });

    const provider = createFakeProvider(schema, { session }, bridge);
    await provider.resolve(state, schema);
    expect(state.current).toEqual(ada);

    const anonymous = createFakeProvider(schema, { session: null }, bridge);
    await anonymous.resolve(state, schema);
    expect(state.current).toBeNull();
  });

  it("proves bridged payloads automatically — the author never parses", async () => {
    const state: State<C> = { current: null };
    const forged = { ...session, grants: ["docs:admin"] };
    const provider = createFakeProvider(
      schema,
      { session: forged },
      (payload) => ({
        id: payload.sub,
        scopes: payload.grants,
        roles: payload.groups,
        meta: { plan: "pro" },
      }),
    );

    await expect(provider.resolve(state, schema)).rejects.toThrow(SchemaError);
    expect(state.current).toBeNull();
  });

  it("leaves state untouched for an out-of-band login", async () => {
    const state: State<C> = { current: null };
    const provider = createFakeProvider(
      schema,
      { session: null },
      (payload) => ({
        id: payload.sub,
        scopes: payload.grants,
        roles: payload.groups,
        meta: { plan: "free" },
      }),
    );

    await provider.login(state, schema);
    expect(state.current).toBeNull();
  });
});
