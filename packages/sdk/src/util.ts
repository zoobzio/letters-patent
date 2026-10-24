import type { Node } from "./types";

import { object } from "objectively";

/**
 * Whether a value can be walked and written by key: a container, or an
 * array — arrays are string-indexable at runtime (`"0"`, `"length"`), which
 * is exactly how the guarded state's draft walk addresses them.
 */
export const indexable = (value: unknown): value is Node =>
  object(value) || Array.isArray(value);
