import type { Req, Source } from "./types";

import { readFile } from "node:fs/promises";
import { posix, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DISCOVERY } from "./constant";

/**
 * Normalizes an authored relative path to posix form: unified separators,
 * no `./` segments, no trailing slash.
 */
export const normalize = (path: string): string =>
  posix.normalize(path.replaceAll("\\", "/")).replace(/\/$/, "");

/**
 * Whether a normalized path is a relative path below its directory. An
 * absolute path, the directory itself, and a path that reaches a parent are
 * not. The kit checks this wherever it writes or removes files.
 */
export const inside = (path: string): boolean => {
  if (posix.isAbsolute(path) || win32.isAbsolute(path)) {
    return false;
  }
  return path !== "." && path !== ".." && !path.startsWith("../");
};

/** A file URL with a trailing slash from a directory path. */
export const directory = (path: string): URL => {
  const url = pathToFileURL(path);
  return url.href.endsWith("/") ? url : new URL(`${url.href}/`);
};

/**
 * Resolves a source to a URL. An absolute URL (`https:`, `file:`) stays as
 * it is; a plain path resolves against `base`.
 */
export const locate = (source: Source, base: URL): URL =>
  typeof source === "string" ? new URL(source, base) : source;

/**
 * Resolves an issuer source to the discovery document to read. A local
 * file and a URL that already names a well-known document are read as
 * they are; an issuer identifier gets the OpenID Connect discovery path
 * appended.
 */
export const locateIssuer = (source: Source, base: URL): URL => {
  const url = locate(source, base);
  if (url.protocol === "file:" || url.pathname.includes("/.well-known/")) {
    return url;
  }
  const trimmed = url.href.replace(/\/+$/, "");
  return new URL(`${trimmed}${DISCOVERY}`);
};

/**
 * The default document loader: `file:` URLs from the filesystem, every
 * other URL through `fetch`.
 */
export const request: Req = async (src) => {
  if (src.protocol === "file:") {
    return readFile(src, "utf8");
  }
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(
      `@letters-patent/kit: fetching ${src.href} failed with ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
};

/**
 * The loader of one build: reads every document through `req`, and records
 * each local file it read once, in read order.
 */
export interface Loader {
  base: URL;
  load: Req;
  documents: string[];
}

export const loader = (root: string, req?: Req): Loader => {
  const base = directory(root);
  const documents: string[] = [];
  const load: Req = async (src) => {
    if (src.protocol === "file:") {
      const path = fileURLToPath(src);
      if (!documents.includes(path)) {
        documents.push(path);
      }
    }
    return (req ?? request)(src);
  };
  return { base, load, documents };
};
