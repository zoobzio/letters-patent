import { defineConfig } from "vitest/config";

/**
 * The server side runs in vitest with no Nuxt environment: the tests mount
 * the auth handlers on a plain h3 app and drive the stubbed provider over
 * HTTP.
 */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
