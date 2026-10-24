import type { Claims } from "@letters-patent/example-patents/issuers/google";
import type { User } from "@letters-patent/example-patents/config";

/**
 * A demo account: the claims Google would have put in its ID token, and
 * the app's own record — what Google cannot know, and what the build
 * warned the bridge must supply.
 */
export interface Account {
  claims: Claims;
  scopes: NonNullable<User["scopes"]>;
  roles: NonNullable<User["roles"]>;
  groups: NonNullable<User["groups"]>;
  entitlements: NonNullable<User["entitlements"]>;
  plan: User["meta"]["plan"];
  workspace: User["meta"]["workspace"];
}

/**
 * The accounts the stubbed sign-in offers. Shared between the login page,
 * which lists them, and the server, which establishes them.
 */
export const accounts: readonly Account[] = [
  {
    claims: {
      sub: "104958204857204857204",
      email: "ada@acme.example",
      email_verified: true,
      name: "Ada Lovelace",
      given_name: "Ada",
      family_name: "Lovelace",
    },
    scopes: ["docs:read", "docs:write"],
    roles: ["editor"],
    groups: ["engineering"],
    entitlements: ["beta"],
    plan: "team",
    workspace: "acme",
  },
  {
    claims: {
      sub: "118273645928374650912",
      email: "grace@acme.example",
      email_verified: true,
      name: "Grace Hopper",
      given_name: "Grace",
      family_name: "Hopper",
    },
    scopes: ["docs:read", "docs:write", "billing:manage"],
    roles: ["admin"],
    groups: ["engineering", "sales"],
    entitlements: ["beta", "export"],
    plan: "enterprise",
    workspace: "acme",
  },
  {
    claims: {
      sub: "109384756102938475610",
      email: "guest@acme.example",
      email_verified: false,
      name: "Guest",
    },
    scopes: ["docs:read"],
    roles: ["viewer"],
    groups: [],
    entitlements: [],
    plan: "free",
    workspace: "acme",
  },
];

/** The account for a subject, when the app knows it. */
export const lookup = (sub: string): Account | undefined =>
  accounts.find((account) => account.claims.sub === sub);
