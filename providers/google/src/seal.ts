import { bytes, decode, encode, sha256, text } from "./util";

/**
 * The AES-GCM key a secret derives: its SHA-256 digest, so any string of
 * sufficient entropy serves.
 */
const key = async (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", await sha256(secret), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);

/**
 * Seals a value into an opaque, tamper-evident token: AES-GCM over its JSON
 * with a fresh IV, as `base64url(iv).base64url(ciphertext)`. The browser
 * holds it, and can neither read nor alter it.
 */
export const seal = async (secret: string, value: unknown): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(secret),
    bytes(JSON.stringify(value)),
  );
  return `${encode(iv)}.${encode(new Uint8Array(sealed))}`;
};

/**
 * Opens a sealed token back into its value, or `undefined` for anything
 * that is not a token this secret sealed: malformed, tampered, or sealed
 * under another secret. Never throws — an unusable cookie is simply absent.
 */
export const open = async (
  secret: string,
  token: string,
): Promise<unknown | undefined> => {
  const [iv, sealed, ...rest] = token.split(".");
  if (iv === undefined || sealed === undefined || rest.length > 0) {
    return undefined;
  }
  try {
    const opened = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(iv) },
      await key(secret),
      decode(sealed),
    );
    return JSON.parse(text(new Uint8Array(opened))) as unknown;
  } catch {
    return undefined;
  }
};
