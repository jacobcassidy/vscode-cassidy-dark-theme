import { readFile, writeFile, lstat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../package.json", import.meta.url));
const target = join(homedir(), ".vscode/extensions/jacobcassidy.cassidy-dark-dev/package.json");

const manifest = JSON.parse(await readFile(source, "utf8"));
manifest.name = "cassidy-dark-dev";
manifest.displayName = "Cassidy Dark Dev";

// Refuse to overwrite the source through a linked dev manifest.
const targetInfo = await lstat(target).catch((error) => {
  if (error.code !== "ENOENT") throw error;
  return null;
});
if (targetInfo?.isSymbolicLink()) {
  throw new Error(`Dev manifest is a symlink; replace it with a regular file: ${target}`);
}

await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Synced dev manifest: ${target}`);
