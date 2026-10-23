import type { H3Event } from "h3";
import type { Settings } from "../src/types";

import { beforeEach, describe, expect, it } from "vitest";

import { GOOGLE, JWKS_COOLDOWN } from "../src/constant";
import { GoogleError } from "../src/error";
import { forget, verify } from "../src/token";
import { bytes, encode } from "../src/util";
import { fakeGoogle } from "./google";

const settingsFor = async () => {
  const google = await fakeGoogle();
  const settings: Settings = {
    event: {} as H3Event,
    clientId: google.clientId,
    clientSecret: google.clientSecret,
    redirectUri: google.redirectUri,
    secret: "x".repeat(32),
    scopes: ["openid"],
    offline: false,
    redirect: "/",
    cookie: {
      name: "lp",
      maxAge: 60,
      path: "/",
      sameSite: "lax",
      secure: false,
    },
    endpoints: GOOGLE,
    fetch: google.fetch,
  };
  return { google, settings };
};

const failing = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as GoogleError;
  }
  throw new Error("expected the ID token to be rejected");
};

describe("verify", () => {
  beforeEach(() => {
    forget();
  });

  it("accepts a token Google signed for this client", async () => {
    const { google, settings } = await settingsFor();
    const claims = await verify(
      settings,
      await google.sign(google.claims({ nonce: "n-1" })),
      { nonce: "n-1" },
    );
    expect(claims.sub).toBe(google.profile.sub);
    expect(claims.email).toBe("ada@example.com");
  });

  it("accepts the bare issuer form", async () => {
    const { google, settings } = await settingsFor();
    await expect(
      verify(
        settings,
        await google.sign(google.claims({ iss: "accounts.google.com" })),
      ),
    ).resolves.toMatchObject({ iss: "accounts.google.com" });
  });

  it.each([
    ["not a JWT", async () => "nope"],
    [
      "too many parts",
      async (g: Awaited<ReturnType<typeof fakeGoogle>>) =>
        `${await g.sign(g.claims())}.extra`,
    ],
    ["a malformed header", async () => "!!.e30.sig"],
    [
      "alg none",
      async (g: Awaited<ReturnType<typeof fakeGoogle>>) =>
        g.sign(g.claims(), { alg: "none", kid: "k" }),
    ],
    [
      "a header without kid",
      async (g: Awaited<ReturnType<typeof fakeGoogle>>) =>
        g.sign(g.claims(), { alg: "RS256" }),
    ],
  ])("rejects %s", async (_label, make) => {
    const { google, settings } = await settingsFor();
    const error = await failing(verify(settings, await make(google)));
    expect(error).toBeInstanceOf(GoogleError);
    expect(error.code).toBe("token");
    expect(error.statusCode).toBe(400);
  });

  it("rejects a token signed by an unknown key", async () => {
    const { google, settings } = await settingsFor();
    const token = await google.sign(google.claims(), {
      alg: "RS256",
      kid: "unknown",
    });
    const error = await failing(verify(settings, token));
    expect(error.message).toMatch(/signing key is unknown/);
  });

  it("rejects a token whose signature does not match", async () => {
    const { google, settings } = await settingsFor();
    const token = await google.sign(google.claims());
    const [head, , signature] = token.split(".") as [string, string, string];
    const body = encode(
      bytes(JSON.stringify(google.claims({ sub: "someone-else" }))),
    );
    const error = await failing(
      verify(settings, `${head}.${body}.${signature}`),
    );
    expect(error.message).toMatch(/signature is invalid/);
  });

  it.each([
    ["another issuer", { iss: "https://evil.example" }, /not issued by Google/],
    ["another client", { aud: "other-client" }, /for another client/],
    [
      "an expired token",
      { exp: Math.floor(Date.now() / 1000) - 120 },
      /expired/,
    ],
    [
      "a token from the future",
      { iat: Math.floor(Date.now() / 1000) + 600 },
      /future/,
    ],
    ["missing standard claims", { sub: undefined }, /standard claims/],
  ])("rejects %s", async (_label, overrides, message) => {
    const { google, settings } = await settingsFor();
    const error = await failing(
      verify(settings, await google.sign(google.claims(overrides))),
    );
    expect(error.code).toBe("token");
    expect(error.message).toMatch(message);
  });

  it("tolerates a minute of clock skew", async () => {
    const { google, settings } = await settingsFor();
    const now = Math.floor(Date.now() / 1000);
    await expect(
      verify(
        settings,
        await google.sign(google.claims({ exp: now - 30, iat: now + 30 })),
      ),
    ).resolves.toBeDefined();
  });

  it("requires the flow's nonce when one is expected", async () => {
    const { google, settings } = await settingsFor();
    const error = await failing(
      verify(settings, await google.sign(google.claims({ nonce: "n-1" })), {
        nonce: "n-2",
      }),
    );
    expect(error.message).toMatch(/nonce/);
  });

  it("enforces the hosted domain", async () => {
    const { google, settings } = await settingsFor();
    const bound = { ...settings, hostedDomain: "example.com" };
    await expect(
      verify(bound, await google.sign(google.claims({ hd: "example.com" }))),
    ).resolves.toMatchObject({ hd: "example.com" });
    const error = await failing(
      verify(bound, await google.sign(google.claims({ hd: "other.com" }))),
    );
    expect(error.message).toMatch(/hosted domain/);
  });

  it("caches the key set across verifications", async () => {
    const { google, settings } = await settingsFor();
    await verify(settings, await google.sign(google.claims()));
    await verify(settings, await google.sign(google.claims()));
    expect(google.jwksFetches).toBe(1);
  });

  it("refetches the key set for an unknown key id once the cooldown has passed", async () => {
    const { google, settings } = await settingsFor();
    await verify(settings, await google.sign(google.claims()));
    await google.rotate();

    // Within the cooldown the stale set stands: the new key is unknown.
    await expect(
      failing(verify(settings, await google.sign(google.claims()))),
    ).resolves.toMatchObject({ code: "token" });
    expect(google.jwksFetches).toBe(1);

    const realNow = Date.now;
    Date.now = () => realNow() + JWKS_COOLDOWN + 1000;
    try {
      await expect(
        verify(settings, await google.sign(google.claims())),
      ).resolves.toBeDefined();
      expect(google.jwksFetches).toBe(2);
    } finally {
      Date.now = realNow;
    }
  });
});
