import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: ["src/index", "src/kit", "src/config"],
  outDir: ".dist",
  declaration: true,
  rollup: {
    emitCJS: false,
  },
});
