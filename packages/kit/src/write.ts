import type { Output } from "./types";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { MANIFEST } from "./constant";
import { inside, normalize } from "./source";
import { toDocument } from "./util";

/**
 * Reads the paths the manifest file in an output directory lists. No paths
 * when the file is missing or unreadable; an entry that reaches outside the
 * directory is dropped.
 */
const readManifest = async (dir: string): Promise<string[]> => {
  let text: string;
  try {
    text = await readFile(join(dir, MANIFEST), "utf8");
  } catch {
    return [];
  }
  const files = toDocument(text)?.files;
  if (!Array.isArray(files)) {
    return [];
  }
  return files.filter(
    (path): path is string =>
      typeof path === "string" && inside(normalize(path)),
  );
};

/** Records the paths a write produced in the manifest file. */
const writeManifest = async (dir: string, files: string[]): Promise<void> => {
  await writeFile(
    join(dir, MANIFEST),
    `${JSON.stringify({ files }, null, 2)}\n`,
  );
};

/**
 * Writes the files of an output under `<root>/<outDir>`. The kit overwrites
 * its own files in place, and removes a file the manifest in the directory
 * lists that the output omits. The directory can hold authored source; only
 * listed files are removed.
 *
 * @param output - The output to write.
 * @param root - The project root.
 */
export const writeOutput = async (
  output: Output,
  root: string,
): Promise<void> => {
  const dir = resolve(root, output.outDir);
  await mkdir(dir, { recursive: true });

  const produced = output.files.map((file) => file.path);
  for (const path of await readManifest(dir)) {
    if (!produced.includes(path)) {
      await rm(join(dir, path), { force: true });
    }
  }

  for (const file of output.files) {
    const target = join(dir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.contents);
  }
  await writeManifest(dir, produced);
};
