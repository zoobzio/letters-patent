import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: ["./src/module.ts", "./src/constant.ts"],
      outDir: ".dist",
      rolldown: { external: ["@nuxt/schema"] },
    },
    // The runtime and server handlers ship unbundled: Nuxt resolves these
    // files by path and compiles them in the app, where the #app/#imports
    // virtuals exist.
    {
      type: "transform",
      input: "./src/runtime",
      outDir: ".dist/runtime",
      // The plugin and the middleware are Nuxt entry points with no type
      // surface of their own, so they ship without declarations.
      dts: (file) =>
        !file.endsWith("plugin.ts") && !file.endsWith("middleware/auth.ts"),
    },
    {
      type: "transform",
      input: "./src/server",
      outDir: ".dist/server",
    },
  ],
  hooks: {
    // Nuxt's auto-import type template resolves the transformed modules
    // without an extension, so each `.d.mts` gets a `.d.ts` re-export twin.
    end: async (ctx) => {
      for (const sub of ["runtime", "runtime/middleware", "server"]) {
        const dir = join(ctx.pkgDir, ".dist", sub);
        for (const file of await readdir(dir)) {
          if (!file.endsWith(".d.mts")) continue;
          const name = file.slice(0, -".d.mts".length);
          await writeFile(
            join(dir, `${name}.d.ts`),
            `export * from "./${name}.mjs";\n`,
          );
        }
      }
    },
  },
});
