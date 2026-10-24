import { parseArgs } from "node:util";

import { build } from "./build";

const HELP = `Usage: patent build [options]

Builds the contract patent.config.ts points at: reads the Protected Resource
Metadata, the claims request, and each issuer's discovery document, and
writes the contract modules to the output directory.

Options:
  -c, --config <file>  Config file (default: patent.config.ts)
  -r, --root <dir>     Project root (default: current directory)
  -h, --help           Show this help`;

const main = async (argv: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c" },
      root: { type: "string", short: "r" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }
  if (positionals.length !== 1 || positionals[0] !== "build") {
    console.error(HELP);
    process.exitCode = 1;
    return;
  }

  const output = await build({ config: values.config, root: values.root });
  for (const warning of output.warnings) {
    console.warn(`@letters-patent/kit: warning: ${warning}`);
  }
  console.log(
    `@letters-patent/kit: wrote ${output.files.length} files to ${output.outDir}`,
  );
};

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
