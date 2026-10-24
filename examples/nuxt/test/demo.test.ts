import { describe, expect, it } from "vitest";

import { defineAuthHandlers } from "@letters-patent/nuxt/server";
import { createApp, createRouter, toWebHandler } from "h3";

import { accounts } from "../shared/accounts";
import {
  COOKIE,
  bridge,
  createDemoProvider,
  schema,
} from "../server/utils/demo";

/**
 * The handlers on a plain h3 app, driven over HTTP: what Nitro mounts in
 * the app, without Nuxt.
 */
const handler = toWebHandler(
  createApp().use(
    createRouter().use(
      "/api/auth/:action",
      defineAuthHandlers(schema, (event) =>
        createDemoProvider(schema, { event }, bridge),
      ),
    ),
  ),
);

const request = (
  action: string,
  init: {
    cookie?: string;
    method?: string;
    navigate?: boolean;
    query?: string;
  } = {},
) =>
  handler(
    new Request(`http://acme.test/api/auth/${action}${init.query ?? ""}`, {
      method: init.method ?? "GET",
      headers: {
        "sec-fetch-mode": init.navigate === false ? "cors" : "navigate",
        ...(init.cookie === undefined ? {} : { cookie: init.cookie }),
      },
      redirect: "manual",
    }),
  );

/** The JSON answer, or `null` for the empty body h3 sends for `null`. */
const body = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  return text === "" ? null : (JSON.parse(text) as unknown);
};

const ada = accounts[0]!;
const session = `${COOKIE}=${ada.claims.sub}`;

describe("the stubbed provider", () => {
  it("answers no user without a session", async () => {
    const response = await request("session", { navigate: false });
    expect(await body(response)).toBeNull();
  });

  it("signs a demo account in and sends the browser on", async () => {
    const response = await request("login", {
      method: "POST",
      query: `?as=${ada.claims.sub}&redirect=/docs`,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/docs");
    expect(response.headers.get("set-cookie")).toContain(session);
  });

  it("sends an unknown account back to the login page", async () => {
    const response = await request("login", {
      method: "POST",
      query: "?as=nobody",
    });
    expect(response.headers.get("location")).toBe("/login");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refuses an external redirect", async () => {
    const response = await request("login", {
      method: "POST",
      query: `?as=${ada.claims.sub}&redirect=//evil.test`,
    });
    expect(response.headers.get("location")).toBe("/");
  });

  it("establishes the user through the bridge on every request", async () => {
    const response = await request("session", {
      cookie: session,
      navigate: false,
    });
    expect(await body(response)).toEqual({
      sub: ada.claims.sub,
      email: "ada@acme.example",
      email_verified: true,
      name: "Ada Lovelace",
      scopes: ["docs:read", "docs:write"],
      roles: ["editor"],
      groups: ["engineering"],
      entitlements: ["beta"],
      meta: { plan: "team", workspace: "acme" },
    });
  });

  it("clears a session for an account the app no longer knows", async () => {
    const response = await request("session", {
      cookie: `${COOKIE}=gone`,
      navigate: false,
    });
    expect(await body(response)).toBeNull();
    expect(response.headers.get("set-cookie")).toContain(`${COOKIE}=;`);
  });

  it("signs out", async () => {
    const response = await request("logout", {
      method: "POST",
      cookie: session,
      navigate: false,
    });
    expect(await body(response)).toBeNull();
    expect(response.headers.get("set-cookie")).toContain(`${COOKIE}=;`);
  });

  it("offers refresh because the issuer supports the grant", async () => {
    const response = await request("refresh", {
      method: "POST",
      cookie: session,
      navigate: false,
    });
    expect(await body(response)).toMatchObject({ sub: ada.claims.sub });
  });
});
