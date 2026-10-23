import { describe, expect, it } from "vitest";

import { open, seal } from "../src/seal";

const secret = "a-sealing-secret-with-plenty-of-characters";

describe("seal", () => {
  it("round-trips a value through an opaque token", async () => {
    const token = await seal(secret, { sub: "1", n: 2, ok: true });
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(token).not.toContain("sub");
    await expect(open(secret, token)).resolves.toEqual({
      sub: "1",
      n: 2,
      ok: true,
    });
  });

  it("uses a fresh IV per seal", async () => {
    const a = await seal(secret, "same");
    const b = await seal(secret, "same");
    expect(a).not.toBe(b);
  });

  it("refuses a tampered token", async () => {
    const token = await seal(secret, { role: "user" });
    const [iv, body] = token.split(".") as [string, string];
    const flipped = body[4] === "A" ? "B" : "A";
    await expect(
      open(secret, `${iv}.${body.slice(0, 4)}${flipped}${body.slice(5)}`),
    ).resolves.toBeUndefined();
  });

  it("refuses a token sealed under another secret", async () => {
    const token = await seal(secret, { role: "user" });
    await expect(open(`${secret}-rotated`, token)).resolves.toBeUndefined();
  });

  it("refuses anything that is not a token", async () => {
    await expect(open(secret, "")).resolves.toBeUndefined();
    await expect(open(secret, "one-part")).resolves.toBeUndefined();
    await expect(open(secret, "a.b.c")).resolves.toBeUndefined();
    await expect(open(secret, "!!.??")).resolves.toBeUndefined();
  });
});
