import { record } from "objectively";

/** Whether a value is a non-empty string. */
export const isText = (value: unknown): value is string =>
  typeof value === "string" && value !== "";

/** Whether a value is an array of strings. */
export const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

/**
 * Parses JSON text to a document. Returns `undefined` when the text is not
 * JSON, or when the JSON is not an object.
 */
export const toDocument = (
  text: string,
): Record<string, unknown> | undefined => {
  try {
    const value: unknown = JSON.parse(text);
    return record(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Makes a display name from an id. Splits on `-`, `_`, `.`, `:`, and
 * whitespace, and capitalizes each word: `docs:read` becomes `Docs Read`.
 */
export const title = (id: string): string =>
  id
    .split(/[-_.:\s]+/)
    .filter((word) => word !== "")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");

/** Pretty JSON, also a valid JavaScript expression. */
export const json = (value: unknown): string => JSON.stringify(value, null, 2);

/** The repeated entries of a list of strings, each once. */
export const repeated = (list: readonly string[]): string[] => {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const entry of list) {
    if (seen.has(entry)) {
      twice.add(entry);
    }
    seen.add(entry);
  }
  return [...twice];
};
