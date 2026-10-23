const utf8 = { encoder: new TextEncoder(), decoder: new TextDecoder() };

/** Bytes WebCrypto accepts: backed by a plain `ArrayBuffer`. */
export type Bytes = Uint8Array<ArrayBuffer>;

/**
 * Bytes as a base64url string without padding — the alphabet JWTs and
 * cookies share.
 */
export const encode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/**
 * A base64url string back to bytes. Throws on a malformed string.
 */
export const decode = (text: string): Bytes => {
  const padded =
    text.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (text.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

/** A string as UTF-8 bytes. */
export const bytes = (text: string): Bytes => utf8.encoder.encode(text);

/** UTF-8 bytes as a string. */
export const text = (value: Uint8Array): string => utf8.decoder.decode(value);

/** Cryptographically random bytes, base64url encoded. */
export const random = (size = 32): string =>
  encode(crypto.getRandomValues(new Uint8Array(size)));

/** The SHA-256 digest of a string. */
export const sha256 = async (value: string): Promise<Bytes> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(value)));

/**
 * A value as a path within the app, or the fallback. Only an absolute path
 * that does not start a new authority (`//host`, `/\host`) is accepted, so a
 * `redirect` query parameter cannot send the browser off-site after login.
 */
export const internal = (value: unknown, fallback: string): string =>
  typeof value === "string" &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.startsWith("/\\")
    ? value
    : fallback;

/**
 * Whether a value is a plain object.
 */
export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Constant-time string equality — the CSRF state is compared with it.
 */
export const same = (a: string, b: string): boolean => {
  const x = bytes(a);
  const y = bytes(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i % x.length] ?? 0) ^ (y[i % y.length] ?? 0);
  }
  return diff === 0;
};
