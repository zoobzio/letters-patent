import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: [
    "src/module",
    "src/constant",
    "src/server/handlers",
    // The runtime is shipped unbundled: Nuxt resolves these files by path and
    // compiles them in the app, where the #app/#imports virtuals exist.
    { input: "src/runtime/", outDir: ".dist/runtime", builder: "mkdist" },
  ],
  outDir: ".dist",
  declaration: true,
  externals: [
    "vue",
    "#app",
    "#imports",
    "#build/letters-patent.mjs",
    "#build/types/letters-patent.d.ts",
    "@nuxt/kit",
    "@nuxt/schema",
    "letters-patent",
    "letters-patent/kit",
    "h3",
  ],
  rollup: {
    emitCJS: false,
  },
});
