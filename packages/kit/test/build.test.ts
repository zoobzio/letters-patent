import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { defineSchema } from "@letters-patent/schema";

import { build, defineConfig, generate } from "../src/build";
import { emit } from "../src/emit";
import {
  InvalidConfigError,
  MalformedConfigError,
  MissingConfigError,
} from "../src/error";
import { loadConfig } from "../src/load";
import { resolveKit } from "../src/resolve";
import { inside, locateIssuer, normalize } from "../src/source";
import { writeOutput } from "../src/write";

const FIXTURES = new URL("./fixtures/", import.meta.url);
const ROOT = fileURLToPath(FIXTURES);
const GENERATED = new URL("./fixtures/.generated/", import.meta.url);

afterAll(async () => {
  await rm(GENERATED, { recursive: true, force: true });
});

const config = defineConfig({
  resource: "./resource.json",
  claims: "./claims.json",
  issuers: { google: "./issuers/google.json" },
  describe: {
    scopes: { "docs:read": "Read documents" },
    roles: { admin: "Full control" },
  },
  types: { seat: "number", tags: "string[]" },
});

describe("resolveKit", () => {
  it("reads every document and resolves the kit", async () => {
    const kit = await resolveKit(config, { cwd: ROOT });
    expect(kit.contract).toEqual({
      scopes: ["docs:read", "docs:write"],
      roles: ["admin", "editor"],
      groups: ["eng", "sales"],
      entitlements: ["beta"],
      meta: {
        plan: ["free", "pro"],
        org: "string",
        seat: { values: [1], optional: true },
        locale: "string?",
        tags: "string[]?",
      },
    });
    expect(kit.issuers.map((issuer) => issuer.id)).toEqual(["google"]);
    expect(kit.manifest.scopes[0]?.description).toBe("Read documents");
    expect(kit.manifest.roles[0]?.description).toBe("Full control");
    expect(kit.outDir).toBe("patent");
    expect(kit.documents.map((path) => path.slice(ROOT.length))).toEqual([
      "resource.json",
      "claims.json",
      "issuers/google.json",
    ]);
    expect(kit.warnings).toEqual([
      expect.stringMatching(/does not publish roles/),
      expect.stringMatching(/does not publish groups/),
      expect.stringMatching(/does not publish entitlements/),
      expect.stringMatching(/does not publish plan/),
      expect.stringMatching(/does not publish org/),
      expect.stringMatching(/does not publish seat/),
      expect.stringMatching(/standard claim locale/),
      expect.stringMatching(/does not publish tags/),
    ]);
  });

  it("reads through the caller's loader", async () => {
    const urls: string[] = [];
    const kit = await resolveKit(
      { resource: "./resource.json" },
      {
        cwd: ROOT,
        req: async (url) => {
          urls.push(url.href);
          return readFile(url, "utf8");
        },
      },
    );
    expect(urls).toEqual([new URL("resource.json", FIXTURES).href]);
    expect(kit.contract.roles).toEqual([]);
    expect(kit.claims.requested).toEqual([]);
  });

  it("rejects a bad config before reading", async () => {
    await expect(
      resolveKit({ resource: "" as string }, { cwd: ROOT }),
    ).rejects.toThrow(InvalidConfigError);
    await expect(
      resolveKit({ ...config, outDir: "../out" }, { cwd: ROOT }),
    ).rejects.toThrow(/outDir/);
    await expect(
      resolveKit({ ...config, issuers: { Google: "./x.json" } }, { cwd: ROOT }),
    ).rejects.toThrow(/issuer id/);
    await expect(
      resolveKit(
        { ...config, types: { seat: "number?" as "number" } },
        { cwd: ROOT },
      ),
    ).rejects.toThrow(/bare keyword/);
  });

  it("names a document that is not JSON", async () => {
    await expect(
      resolveKit({ resource: "./patent.config.ts" }, { cwd: ROOT }),
    ).rejects.toThrow(/patent\.config\.ts: is not valid JSON/);
  });
});

describe("source", () => {
  it("locates an issuer's discovery document", () => {
    const base = pathToFileURL("/project/");
    expect(locateIssuer("https://accounts.google.com", base).href).toBe(
      "https://accounts.google.com/.well-known/openid-configuration",
    );
    expect(locateIssuer("https://as.example/tenant/", base).href).toBe(
      "https://as.example/tenant/.well-known/openid-configuration",
    );
    expect(
      locateIssuer(
        "https://as.example/.well-known/oauth-authorization-server",
        base,
      ).href,
    ).toBe("https://as.example/.well-known/oauth-authorization-server");
    expect(locateIssuer("./issuers/google.json", base).href).toBe(
      "file:///project/issuers/google.json",
    );
  });

  it("normalizes and bounds output paths", () => {
    expect(normalize("./patent/")).toBe("patent");
    expect(inside("patent")).toBe(true);
    expect(inside("../patent")).toBe(false);
    expect(inside("/patent")).toBe(false);
    expect(inside(".")).toBe(false);
  });
});

describe("emit", () => {
  const OUT = new URL("emit/", GENERATED);

  it("writes modules an app imports back, typed by the contract", async () => {
    const output = await generate(config, { cwd: ROOT });
    expect(output.files.map((file) => file.path)).toEqual([
      "index.mjs",
      "index.d.mts",
      "config.mjs",
      "config.d.mts",
      "manifest.mjs",
      "manifest.d.mts",
      "issuers/google.mjs",
      "issuers/google.d.mts",
      "issuers.mjs",
      "issuers.d.mts",
      "resource.json",
    ]);

    await rm(OUT, { recursive: true, force: true });
    await writeOutput({ ...output, outDir: fileURLToPath(OUT) }, ROOT);

    const index = await import(new URL("index.mjs", OUT).href);
    expect(index.scopes).toEqual(["docs:read", "docs:write"]);
    expect(index.groups).toEqual(["eng", "sales"]);
    expect(index.isScope("docs:read")).toBe(true);
    expect(index.isScope("docs:delete")).toBe(false);
    expect(index.isRole("admin")).toBe(true);
    expect(index.isGroup("eng")).toBe(true);
    expect(index.isEntitlement("beta")).toBe(true);
    expect(index.isEntitlement(1)).toBe(false);

    const built = await import(new URL("config.mjs", OUT).href);
    const schema = defineSchema(built.contract);
    expect(
      schema.check.user({ sub: "u", meta: { plan: "pro", org: "z" } }),
    ).toBe(true);
    expect(built.default.contract).toBe(built.contract);

    const manifest = await import(new URL("manifest.mjs", OUT).href);
    expect(manifest.manifest.scopes[0]).toEqual({
      id: "docs:read",
      name: "Docs Read",
      description: "Read documents",
    });

    const google = await import(new URL("issuers/google.mjs", OUT).href);
    expect(google.issuer.caps.refresh).toBe(true);
    expect(google.issuer.endpoints.jwks).toBe(
      "https://www.googleapis.com/oauth2/v3/certs",
    );
    const issuers = await import(new URL("issuers.mjs", OUT).href);
    expect(issuers.issuers).toEqual([
      { id: "google", issuer: "https://accounts.google.com" },
    ]);

    const resource = JSON.parse(
      await readFile(new URL("resource.json", OUT), "utf8"),
    );
    expect(resource.resource).toBe("https://app.example");
    expect(resource.bearer_methods_supported).toEqual(["header"]);
  });

  it("declares the literal types", async () => {
    const output = await generate(config, { cwd: ROOT });
    const text = (path: string) =>
      output.files.find((file) => file.path === path)?.contents ?? "";

    expect(text("index.d.mts")).toContain(
      'export type Scope =\n  | "docs:read"\n  | "docs:write";',
    );
    expect(text("config.d.mts")).toContain(
      'scopes: readonly ["docs:read", "docs:write"];',
    );
    expect(text("config.d.mts")).toContain('"plan": readonly ["free", "pro"];');
    expect(text("config.d.mts")).toContain('"org": "string";');
    expect(text("config.d.mts")).toContain(
      '"seat": { readonly values: readonly [1]; readonly optional: true };',
    );
    expect(text("config.d.mts")).toContain(
      "export type User = PatentUser<Meta>;",
    );
    expect(text("issuers/google.d.mts")).toContain(
      "  email_verified?: boolean;",
    );
    expect(text("issuers/google.d.mts")).toContain("readonly refresh: true;");
    expect(text("issuers/google.d.mts")).toContain(
      "readonly endSession: false;",
    );
    expect(text("issuers.d.mts")).toContain(
      'export type IssuerId =\n  | "google";',
    );
  });

  it("emits from a bare contract, with no issuer or resource files", () => {
    const files = emit({
      contract: {
        scopes: ["a"],
        roles: [],
        groups: [],
        entitlements: [],
        meta: {},
      },
    });
    expect(files.map((file) => file.path)).toEqual([
      "index.mjs",
      "index.d.mts",
      "config.mjs",
      "config.d.mts",
      "manifest.mjs",
      "manifest.d.mts",
      "issuers.mjs",
      "issuers.d.mts",
    ]);
    const types = files.find((file) => file.path === "index.d.mts")?.contents;
    expect(types).toContain("export type Role = never;");
    expect(types).toContain('export type Scope =\n  | "a";');
    const config = files.find((file) => file.path === "config.d.mts")?.contents;
    expect(config).toContain("  meta: {};");
    expect(files[0]?.contents).toContain('from "letters-patent"');
  });
});

describe("build", () => {
  it("loads the config, writes the output, and cleans what it no longer produces", async () => {
    const output = await build({ root: ROOT });
    expect(output.outDir).toBe(".generated/patent");
    expect(output.warnings.length).toBeGreaterThan(0);

    const dir = join(ROOT, ".generated/patent");
    const written = await readdir(dir);
    expect(written).toContain("config.mjs");
    expect(written).toContain(".patent.json");
    expect(written).toContain("resource.json");

    // A file the next output omits is removed; an unlisted file stays.
    await writeFile(join(dir, "stray.txt"), "keep");
    await writeOutput(
      { outDir: ".generated/patent", files: [], warnings: [] },
      ROOT,
    );
    const files = (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    expect(files).toEqual([".patent.json", "stray.txt"]);
  });

  it("reports a missing or malformed config", async () => {
    const root = await mkdtemp(join(tmpdir(), "patent-"));
    try {
      await expect(loadConfig(join(root, "patent.config.ts"))).rejects.toThrow(
        MissingConfigError,
      );
      await writeFile(join(root, "patent.config.ts"), "export default 42;");
      await expect(loadConfig(join(root, "patent.config.ts"))).rejects.toThrow(
        MalformedConfigError,
      );
      await mkdir(join(root, "auth"));
      await writeFile(
        join(root, "auth/resource.json"),
        JSON.stringify({
          resource: "https://x.example",
          scopes_supported: ["a"],
        }),
      );
      await writeFile(
        join(root, "patent.config.ts"),
        'export default { resource: "./auth/resource.json", outDir: "out" };',
      );
      const output = await build({ root });
      expect(output.outDir).toBe("out");
      expect(await readdir(join(root, "out"))).toContain("index.mjs");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
