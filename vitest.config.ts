import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Whole-repo entry point: each package carries its own vitest.config.ts, and
 * this config federates them as projects so a root `vitest` run (IDE, CI,
 * aggregated coverage) still covers everything. Day-to-day runs go through
 * `pnpm test`, which fans out to the packages in parallel.
 *
 * The projects list is enumerated rather than globbed because vitest errors
 * on a glob that matches nothing, and the workspace starts empty.
 */
const projects = ["packages", "integrations", "providers"].flatMap((dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .map((name) => join(dir, name, "vitest.config.ts"))
        .filter((config) => existsSync(config))
    : [],
);

export default defineConfig({
  test: {
    ...(projects.length > 0 ? { projects } : {}),
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: ".coverage",
      include: [
        "packages/*/src/**/*.ts",
        "integrations/*/src/**/*.ts",
        "providers/*/src/**/*.ts",
      ],
    },
  },
});
