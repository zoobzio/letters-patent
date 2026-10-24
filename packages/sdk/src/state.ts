import type { Contract, Schema } from "@letters-patent/schema";
import type { Node, Path, State } from "./types";

import { object } from "objectively";

import { indexable } from "./util";

/**
 * Builds a guarded {@link State}: a deep proxy over the container that
 * proves every write against the schema before committing it — a top-level
 * `current` assignment, a nested member write (`state.current.email = …`),
 * an array mutation (`state.current.scopes.push(…)`), or a deletion.
 *
 * Mutations are proven on a draft — a clone of the current user with the
 * write applied — so a rejected write throws a {@link SchemaError} and
 * leaves the underlying container untouched. Reads pass through, with
 * nested objects wrapped on the way out so the guard travels with them.
 * The container stays the source of truth: writes land on it in place, so
 * a caller-owned (e.g. reactive) object sees every mutation.
 *
 * @param schema - The validation bundle writes are proven against.
 * @param target - The underlying container; created when omitted.
 * @param observe - Called after every committed write — a top-level
 *   assignment, a deep mutation, or a deletion. A rejected write never
 *   reaches it.
 * @returns The same-shaped state, guarded.
 */
export const defineState = <C extends Contract>(
  schema: Schema<C>,
  target: State<C> = { current: null },
  observe?: () => void,
): State<C> => {
  const wrapped = new WeakMap<object, object>();

  /**
   * Applies a mutation to a draft of the current user and proves the
   * result, throwing before anything real is touched.
   */
  const prove = (mutate: (draft: Node) => void): void => {
    if (target.current === null) {
      return;
    }
    const draft: unknown = structuredClone(target.current);
    if (!indexable(draft)) {
      return;
    }
    mutate(draft);
    schema.assert.user(draft);
  };

  /**
   * Walks a draft down a mutation path to the node a write lands on.
   */
  const locate = (draft: Node, path: Path): Node =>
    path.reduce<Node>((node, key) => {
      const member = node[key];
      return indexable(member) ? member : node;
    }, draft);

  /**
   * Wraps a walkable value in the guarding proxy, remembering the path that
   * reached it. Wrappers are cached per target so repeated reads return the
   * same reference.
   */
  const wrap = (value: object, path: Path): object => {
    const cached = wrapped.get(value);
    if (cached) {
      return cached;
    }
    const proxy = new Proxy(value, {
      get(node, key) {
        const member = Reflect.get(node, key);
        if (typeof key === "string" && indexable(member)) {
          return wrap(member, [...path, key]);
        }
        return member;
      },
      set(node, key, incoming: unknown) {
        if (typeof key === "symbol") {
          return Reflect.set(node, key, incoming);
        }
        prove((draft) => {
          locate(draft, path)[key] = incoming;
        });
        const committed = Reflect.set(node, key, incoming);
        if (committed) {
          observe?.();
        }
        return committed;
      },
      deleteProperty(node, key) {
        if (typeof key === "symbol") {
          return Reflect.deleteProperty(node, key);
        }
        prove((draft) => {
          delete locate(draft, path)[key];
        });
        const committed = Reflect.deleteProperty(node, key);
        if (committed) {
          observe?.();
        }
        return committed;
      },
    });
    wrapped.set(value, proxy);
    return proxy;
  };

  return new Proxy(target, {
    get(container, key) {
      const value = Reflect.get(container, key);
      if (key === "current" && object(value)) {
        return wrap(value, []);
      }
      return value;
    },
    set(container, key, incoming: unknown) {
      if (key === "current" && incoming !== null) {
        schema.assert.user(incoming);
      }
      const committed = Reflect.set(container, key, incoming);
      if (committed && key === "current") {
        observe?.();
      }
      return committed;
    },
  });
};
