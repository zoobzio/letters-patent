import type { H3Event } from "h3";
import type { Meta, User } from "letters-patent";
import type { C } from "./harness";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MAX_AGE, FLOW_MAX_AGE, GOOGLE } from "../src/constant";
import { GoogleError } from "../src/error";
import { createGoogleProvider } from "../src/provider";
import { forget } from "../src/token";
import { fakeGoogle } from "./google";
import {
  cookieOf,
  database,
  flowOf,
  read,
  schema,
  serve,
  signIn,
} from "./harness";

const ada: User<Meta<C>> = {
  sub: "104958204857204857204",
  email: "ada@example.com",
  name: "Ada Lovelace",
  picture: "https://lh3.googleusercontent.com/a/photo",
  email_verified: true,
  scopes: ["docs:read", "docs:write"],
  roles: ["editor"],
  meta: { plan: "pro" },
};

describe("createGoogleProvider", () => {
  beforeEach(() => {
    forget();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("configuration", () => {
    it("refuses a short sealing secret before touching the request", () => {
      const google = { clientId: "c", clientSecret: "s", redirectUri: "r" };
      expect(() =>
        createGoogleProvider(
          schema,
          { event: {} as H3Event, secret: "short", ...google },
          () => ada,
        ),
      ).toThrowError(GoogleError);
    });
  });

  describe("login", () => {
    it("sends a navigating browser to Google with the flow bound to a cookie", async () => {
      const google = await fakeGoogle();
      const served = serve(google);

      const response = await served.request("login");
      expect(response.status).toBe(302);

      const { url, state, nonce, challenge } = flowOf(
        response.headers.get("location") ?? "",
      );
      expect(url.origin + url.pathname).toBe(GOOGLE.authorize);
      expect(url.searchParams.get("client_id")).toBe(google.clientId);
      expect(url.searchParams.get("redirect_uri")).toBe(google.redirectUri);
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("scope")).toBe("openid email profile");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.has("access_type")).toBe(false);
      expect(url.searchParams.has("prompt")).toBe(false);
      expect(url.searchParams.has("hd")).toBe(false);
      expect(state).toHaveLength(43);
      expect(nonce).toHaveLength(43);
      expect(challenge).toHaveLength(43);

      const flow = cookieOf(response, "letters-patent.flow");
      expect(flow).toBeDefined();
      expect(flow?.attributes.has("httponly")).toBe(true);
      expect(flow?.attributes.get("samesite")).toBe("Lax");
      expect(flow?.attributes.get("path")).toBe("/");
      expect(flow?.attributes.get("max-age")).toBe(String(FLOW_MAX_AGE));
      expect(flow?.attributes.has("secure")).toBe(false);
    });

    it("hands a fetching transport the location as data", async () => {
      const served = serve(await fakeGoogle());
      const response = await served.request("login", {
        method: "POST",
        navigate: false,
      });
      expect(response.status).toBe(200);
      const body = (await read(response)) as { location: string };
      expect(body.location).toContain(GOOGLE.authorize);
      expect(served.jar.has("letters-patent.flow")).toBe(true);
    });

    it("passes the configured offline, prompt, hosted domain, and scopes", async () => {
      const served = serve(await fakeGoogle(), {
        offline: true,
        prompt: "consent",
        hostedDomain: "example.com",
        scopes: ["email", "https://www.googleapis.com/auth/calendar.readonly"],
      });
      const response = await served.request("login");
      const { url } = flowOf(response.headers.get("location") ?? "");
      expect(url.searchParams.get("access_type")).toBe("offline");
      expect(url.searchParams.get("prompt")).toBe("consent");
      expect(url.searchParams.get("hd")).toBe("example.com");
      expect(url.searchParams.get("scope")).toBe(
        "openid email https://www.googleapis.com/auth/calendar.readonly",
      );
    });

    it("marks cookies Secure behind HTTPS", async () => {
      const served = serve(await fakeGoogle());
      const response = await served.request("login", {
        headers: { "x-forwarded-proto": "https" },
      });
      expect(
        cookieOf(response, "letters-patent.flow")?.attributes.has("secure"),
      ).toBe(true);
    });
  });

  describe("callback", () => {
    it("establishes the session and lands on the requested path", async () => {
      const google = await fakeGoogle();
      const served = serve(google);

      const response = await signIn(served, google, { redirect: "/docs" });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/docs");

      const session = cookieOf(response, "letters-patent");
      expect(session).toBeDefined();
      expect(session?.attributes.has("httponly")).toBe(true);
      expect(session?.attributes.get("samesite")).toBe("Lax");
      expect(Number(session?.attributes.get("max-age"))).toBeGreaterThan(
        DEFAULT_MAX_AGE - 5,
      );
      expect(session?.value).not.toContain("ada");

      // The flow cookie is single-use.
      expect(
        cookieOf(response, "letters-patent.flow")?.attributes.get("max-age"),
      ).toBe("0");
      expect(served.jar.has("letters-patent.flow")).toBe(false);

      // The code was exchanged with PKCE and the client credentials.
      const exchange = google.calls.find(
        (c) => c.form.get("grant_type") === "authorization_code",
      );
      expect(exchange?.url).toBe(GOOGLE.token);
      expect(exchange?.form.get("code_verifier")).toHaveLength(64);
      expect(exchange?.form.get("client_secret")).toBe(google.clientSecret);
      expect(exchange?.form.get("redirect_uri")).toBe(google.redirectUri);
    });

    it("falls back to the configured path for an off-site redirect", async () => {
      const google = await fakeGoogle();
      for (const [attempt, landing] of [
        ["//evil.example/phish", "/home"],
        ["https://evil.example", "/home"],
        ["/\\evil.example", "/home"],
        ["relative", "/home"],
        ["/account?tab=billing", "/account?tab=billing"],
      ] as const) {
        const served = serve(google, { redirect: "/home" });
        const response = await signIn(served, google, { redirect: attempt });
        expect(response.headers.get("location")).toBe(landing);
      }
    });

    it("hands a fetching caller the landing path as data", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      const login = await served.request("login", {
        query: { redirect: "/docs" },
      });
      const flow = flowOf(login.headers.get("location") ?? "");
      const code = google.issue({
        nonce: flow.nonce,
        challenge: flow.challenge,
      });
      const response = await served.request("callback", {
        query: { code, state: flow.state },
        navigate: false,
      });
      expect(response.status).toBe(200);
      await expect(read(response)).resolves.toEqual({ location: "/docs" });
      expect(served.jar.has("letters-patent")).toBe(true);
    });

    it("rejects a callback without a login flow in progress", async () => {
      const served = serve(await fakeGoogle());
      const response = await served.request("callback", {
        query: { code: "4/x", state: "s" },
      });
      expect(response.status).toBe(400);
      await expect(read(response)).resolves.toEqual({
        code: "flow",
        detail: null,
      });
    });

    it("rejects a state that does not match the flow", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      await served.request("login");
      const response = await served.request("callback", {
        query: { code: "4/x", state: "forged" },
      });
      expect(response.status).toBe(400);
      await expect(read(response)).resolves.toMatchObject({ code: "flow" });
      // The flow was consumed: a retry has nothing to match either.
      expect(served.jar.has("letters-patent.flow")).toBe(false);
    });

    it("surfaces Google's refusal", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      const login = await served.request("login");
      const { state } = flowOf(login.headers.get("location") ?? "");
      const response = await served.request("callback", {
        query: { error: "access_denied", state },
      });
      expect(response.status).toBe(400);
      await expect(read(response)).resolves.toEqual({
        code: "denied",
        detail: "access_denied",
      });
    });

    it("rejects a callback without a code", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      const login = await served.request("login");
      const { state } = flowOf(login.headers.get("location") ?? "");
      const response = await served.request("callback", { query: { state } });
      expect(response.status).toBe(400);
      await expect(read(response)).resolves.toMatchObject({ code: "flow" });
    });

    it("rejects a code Google will not exchange", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      const login = await served.request("login");
      const { state } = flowOf(login.headers.get("location") ?? "");
      const response = await served.request("callback", {
        query: { code: "4/not-issued", state },
      });
      expect(response.status).toBe(400);
      await expect(read(response)).resolves.toEqual({
        code: "exchange",
        detail: "invalid_grant",
      });
      expect(served.jar.has("letters-patent")).toBe(false);
    });

    it("rejects an ID token whose nonce is not the flow's", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      const login = await served.request("login");
      const flow = flowOf(login.headers.get("location") ?? "");
      const code = google.issue({
        nonce: "replayed",
        challenge: flow.challenge,
      });
      const response = await served.request("callback", {
        query: { code, state: flow.state },
      });
      expect(response.status).toBe(400);
      await expect(read(response)).resolves.toMatchObject({ code: "token" });
    });

    it("rejects an account outside the hosted domain", async () => {
      const google = await fakeGoogle();
      google.profile.hd = "other.com";
      const served = serve(google, { hostedDomain: "example.com" });
      const response = await signIn(served, google);
      expect(response.status).toBe(400);
      await expect(read(response)).resolves.toMatchObject({ code: "token" });
    });

    it("refuses a bridge result outside the contract", async () => {
      const google = await fakeGoogle();
      const served = serve(google, {}, (claims) => ({
        sub: claims.sub,
        scopes: ["docs:admin" as "docs:read"],
        roles: [],
        meta: { plan: "free" },
      }));
      const response = await signIn(served, google);
      expect(response.status).toBe(500);
      await expect(read(response)).resolves.toEqual({
        code: "unhandled",
        detail: "SchemaError",
      });
      // Nothing was established, so nothing was sealed.
      expect(served.jar.has("letters-patent")).toBe(false);
      const session = await served.request("session", { navigate: false });
      await expect(read(session)).resolves.toBeNull();
    });
  });

  describe("resolve", () => {
    it("establishes the user from the session cookie through the bridge", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      await signIn(served, google);

      const response = await served.request("session", { navigate: false });
      const user = (await read(response)) as Record<string, unknown>;
      expect(user).toMatchObject(ada);
      expect(user.iat).toBeTypeOf("number");
      expect(user.exp).toBe((user.iat as number) + DEFAULT_MAX_AGE);
    });

    it("reflects the app's records on every request", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      await signIn(served, google);

      database.set(ada.sub, { scopes: ["docs:read"], roles: [], plan: "free" });
      try {
        const response = await served.request("session", { navigate: false });
        await expect(read(response)).resolves.toMatchObject({
          scopes: ["docs:read"],
          roles: [],
          meta: { plan: "free" },
        });
      } finally {
        database.set(ada.sub, {
          scopes: ["docs:read", "docs:write"],
          roles: ["editor"],
          plan: "pro",
        });
      }
    });

    it("answers null without a session", async () => {
      const served = serve(await fakeGoogle());
      const response = await served.request("session", { navigate: false });
      await expect(read(response)).resolves.toBeNull();
    });

    it("answers null and clears a cookie it cannot open", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      await signIn(served, google);
      served.jar.set("letters-patent", "tampered.cookie");

      const response = await served.request("session", { navigate: false });
      await expect(read(response)).resolves.toBeNull();
      expect(
        cookieOf(response, "letters-patent")?.attributes.get("max-age"),
      ).toBe("0");
      expect(served.jar.has("letters-patent")).toBe(false);
    });

    it("answers null for a session sealed under another secret", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      await signIn(served, google);

      const rotated = serve(google, {
        secret: "a-brand-new-secret-after-rotation-happened",
      });
      rotated.jar.set("letters-patent", served.jar.get("letters-patent") ?? "");
      const response = await rotated.request("session", { navigate: false });
      await expect(read(response)).resolves.toBeNull();
    });

    it("answers null once the session has expired", async () => {
      const google = await fakeGoogle();
      const served = serve(google, { cookie: { maxAge: 60 } });
      await signIn(served, google);

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + 61_000);
      const response = await served.request("session", { navigate: false });
      await expect(read(response)).resolves.toBeNull();
    });
  });

  describe("refresh", () => {
    it("slides the session without a refresh token", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      await signIn(served, google);
      const before = (await (
        await served.request("session", { navigate: false })
      ).json()) as { exp: number };

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + 60_000);
      const calls = google.calls.length;
      const response = await served.request("refresh", {
        method: "POST",
        navigate: false,
      });
      const after = (await read(response)) as { exp: number };
      expect(after).toMatchObject(ada);
      expect(after.exp).toBeGreaterThanOrEqual(before.exp + 60);
      expect(after.exp).toBeLessThanOrEqual(before.exp + 61);
      expect(google.calls).toHaveLength(calls);
    });

    it("obtains fresh claims from Google with a refresh token", async () => {
      const google = await fakeGoogle();
      const served = serve(google, { offline: true });
      await signIn(served, google, { refresh: true });

      google.profile.name = "Ada King";
      const response = await served.request("refresh", {
        method: "POST",
        navigate: false,
      });
      await expect(read(response)).resolves.toMatchObject({ name: "Ada King" });
      expect(
        google.calls.filter(
          (c) => c.form.get("grant_type") === "refresh_token",
        ),
      ).toHaveLength(1);
    });

    it("ends the session when the grant is gone", async () => {
      const google = await fakeGoogle();
      const served = serve(google, { offline: true });
      await signIn(served, google, { refresh: true });

      // Revoked out of band — from another device, say: Google refuses the
      // refresh token from now on.
      const original = google.fetch;
      google.fetch = async (input, init) => {
        const form = new URLSearchParams(String(init?.body ?? ""));
        if (form.get("grant_type") === "refresh_token") {
          return new Response(JSON.stringify({ error: "invalid_grant" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        return original(input, init);
      };

      const response = await served.request("refresh", {
        method: "POST",
        navigate: false,
      });
      await expect(read(response)).resolves.toBeNull();
      expect(served.jar.has("letters-patent")).toBe(false);
    });

    it("answers null without a session", async () => {
      const served = serve(await fakeGoogle());
      const response = await served.request("refresh", {
        method: "POST",
        navigate: false,
      });
      await expect(read(response)).resolves.toBeNull();
    });
  });

  describe("logout", () => {
    it("clears the session", async () => {
      const google = await fakeGoogle();
      const served = serve(google);
      await signIn(served, google);

      const response = await served.request("logout", {
        method: "POST",
        navigate: false,
      });
      await expect(read(response)).resolves.toBeNull();
      expect(
        cookieOf(response, "letters-patent")?.attributes.get("max-age"),
      ).toBe("0");
      expect(served.jar.has("letters-patent")).toBe(false);
      expect(google.calls.some((c) => c.url === GOOGLE.revoke)).toBe(false);

      const session = await served.request("session", { navigate: false });
      await expect(read(session)).resolves.toBeNull();
    });

    it("revokes the refresh token when there is one", async () => {
      const google = await fakeGoogle();
      const served = serve(google, { offline: true });
      await signIn(served, google, { refresh: true });

      await served.request("logout", { method: "POST", navigate: false });
      const revoke = google.calls.find((c) => c.url === GOOGLE.revoke);
      expect(revoke).toBeDefined();
      expect(google.revoked.has(revoke?.form.get("token") ?? "")).toBe(true);
    });
  });
});
