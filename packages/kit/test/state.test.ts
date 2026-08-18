import { describe, expect, it } from "vitest";
import type { Meta, User } from "@letters-patent/schema";
import { SchemaError, defineSchema } from "@letters-patent/schema";
import { defineState } from "../src/index";

const schema = defineSchema({
  scopes: ["docs:read", "docs:write"],
  roles: ["editor"],
  meta: { plan: ["free", "pro"] },
});

type C = (typeof schema)["base"];

const ada = (): User<Meta<C>> => ({
  id: "user-1",
  scopes: ["docs:read"],
  roles: ["editor"],
  meta: { plan: "pro" },
});

describe("defineState", () => {
  it("writes through to the underlying container", () => {
    const target = { current: null };
    const state = defineState(schema, target);

    state.current = ada();
    expect(target.current).toEqual(ada());

    state.current = null;
    expect(target.current).toBeNull();
  });

  it("proves a top-level assignment", () => {
    const state = defineState(schema);

    expect(() => {
      state.current = { ...ada(), scopes: ["docs:admin"] };
    }).toThrow(SchemaError);
    expect(state.current).toBeNull();
  });

  it("admits a valid deep write", () => {
    const target: { current: User<Meta<C>> | null } = { current: ada() };
    const state = defineState(schema, target);

    state.current!.email = "banana";
    expect(target.current?.email).toBe("banana");

    state.current!.meta.plan = "free";
    expect(target.current?.meta.plan).toBe("free");
  });

  it("rejects an invalid deep write and leaves the container untouched", () => {
    const target: { current: User<Meta<C>> | null } = { current: ada() };
    const state = defineState(schema, target);

    expect(() => {
      (state.current as unknown as Record<string, unknown>).email = 42;
    }).toThrow(SchemaError);
    expect(target.current?.email).toBeUndefined();

    expect(() => {
      (state.current!.meta as Record<string, unknown>).plan = "gold";
    }).toThrow(SchemaError);
    expect(target.current?.meta.plan).toBe("pro");
  });

  it("guards array mutations", () => {
    const target: { current: User<Meta<C>> | null } = { current: ada() };
    const state = defineState(schema, target);

    state.current!.scopes.push("docs:write");
    expect(target.current?.scopes).toEqual(["docs:read", "docs:write"]);

    expect(() => {
      state.current!.scopes.push("docs:admin" as never);
    }).toThrow(SchemaError);
    expect(target.current?.scopes).toEqual(["docs:read", "docs:write"]);
  });

  it("guards deletions", () => {
    const target: { current: User<Meta<C>> | null } = { current: ada() };
    const state = defineState(schema, target);

    state.current!.email = "ada@example.com";
    delete state.current!.email;
    expect(target.current?.email).toBeUndefined();

    expect(() => {
      delete (state.current as unknown as Record<string, unknown>).id;
    }).toThrow(SchemaError);
    expect(target.current?.id).toBe("user-1");
  });

  it("returns a stable wrapper across reads", () => {
    const state = defineState(schema, { current: ada() });
    expect(state.current).toBe(state.current);
  });

  it("notifies the observer of every committed write, and only those", () => {
    const writes: number[] = [];
    const state = defineState(schema, { current: null }, () =>
      writes.push(writes.length),
    );

    state.current = ada(); // top-level assignment
    state.current!.email = "ada@example.com"; // deep write
    delete state.current!.email; // deletion
    expect(writes.length).toBe(3);

    expect(() => {
      state.current!.meta.plan = "gold" as never; // rejected: not committed
    }).toThrow(SchemaError);
    expect(writes.length).toBe(3);
  });
});
